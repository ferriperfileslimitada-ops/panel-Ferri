const crypto = require('crypto');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const orbitMcpClient = require('./orbit-mcp-client');
const logger = require('./logger');

const router = express.Router();
const MAX_ATTEMPTS = 3;

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está configurada.`);
  return value;
};

const getWorkerConfig = () => ({
  supabaseUrl: getRequiredEnv('VITE_SUPABASE_URL'),
  serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  workerToken: getRequiredEnv('INTEGRATION_WORKER_TOKEN'),
  quotationDocumentId: Number(getRequiredEnv('SIIGO_QUOTATION_DOCUMENT_ID')),
  sellerId: Number(getRequiredEnv('SIIGO_DEFAULT_SELLER_ID')),
  branchOffice: Number(process.env.SIIGO_CUSTOMER_BRANCH_OFFICE || 0),
  taxId: process.env.SIIGO_DEFAULT_TAX_ID ? Number(process.env.SIIGO_DEFAULT_TAX_ID) : null,
});

const assertNumericConfig = (value, name) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un entero positivo.`);
  }
};

const buildQuotationToolArguments = (payload, config) => {
  assertNumericConfig(config.quotationDocumentId, 'SIIGO_QUOTATION_DOCUMENT_ID');
  assertNumericConfig(config.sellerId, 'SIIGO_DEFAULT_SELLER_ID');

  if (!payload?.customer_identification || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('El comando de cotización no contiene cliente e ítems válidos.');
  }

  const items = payload.items.map((item) => {
    if (!item?.code || !Number(item.quantity) || Number(item.quantity) <= 0 || Number(item.price) < 0) {
      throw new Error('La cotización contiene un ítem inválido para Siigo.');
    }

    const mapped = {
      code: String(item.code),
      quantity: Number(item.quantity),
      price: Number(item.price),
    };

    if (config.taxId) mapped.taxes = [{ id: config.taxId }];
    return mapped;
  });

  return {
    quotation: {
      document: { id: config.quotationDocumentId },
      date: payload.date || new Date().toISOString().slice(0, 10),
      customer: {
        identification: String(payload.customer_identification),
        branch_office: config.branchOffice,
      },
      seller: config.sellerId,
      items,
      ...(payload.notes ? { observations: String(payload.notes) } : {}),
    },
  };
};

const extractQuotationReference = (result) => {
  const structured = result?.structuredContent;
  const candidates = [
    structured,
    structured?.data,
    result?.data,
  ];

  for (const candidate of candidates) {
    if (candidate?.id) {
      return { id: String(candidate.id), number: candidate.name ? String(candidate.name) : null };
    }
  }

  const text = Array.isArray(result?.content)
    ? result.content.filter((entry) => entry?.type === 'text').map((entry) => entry.text).join('\n')
    : null;

  if (text) {
    try {
      const parsed = JSON.parse(text);
      const candidate = parsed?.data || parsed;
      if (candidate?.id) {
        return { id: String(candidate.id), number: candidate.name ? String(candidate.name) : null };
      }
    } catch {
      // The MCP result can be a human-readable text response. Keep the audit
      // record, but do not invent an external identifier.
    }
  }

  return { id: null, number: null };
};

const constantTimeEquals = (provided, expected) => {
  const received = Buffer.from(String(provided || ''));
  const configured = Buffer.from(String(expected || ''));
  return received.length === configured.length && crypto.timingSafeEqual(received, configured);
};

router.post('/:outboxId/process', async (req, res) => {
  let config;
  try {
    config = getWorkerConfig();
  } catch (error) {
    return res.status(503).json({ error: 'El worker de integraciones no está configurado.' });
  }

  if (!constantTimeEquals(req.get('x-integration-worker-token'), config.workerToken)) {
    return res.status(401).json({ error: 'Worker no autorizado.' });
  }

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: command, error: readError } = await supabase
    .from('integration_outbox')
    .select('id, command_type, resource_type, local_record_id, payload, status, attempts, correlation_id')
    .eq('id', req.params.outboxId)
    .single();

  if (readError || !command) {
    return res.status(404).json({ error: 'Comando de integración no encontrado.' });
  }

  if (command.status === 'completed') {
    return res.status(200).json({ status: 'already_completed', outbox_id: command.id });
  }

  if (command.status !== 'pending' || command.resource_type !== 'quotation' || command.command_type !== 'create') {
    return res.status(409).json({ error: 'El comando no está listo para procesarse.' });
  }

  const { data: claimed, error: claimError } = await supabase
    .from('integration_outbox')
    .update({ status: 'processing', attempts: command.attempts + 1 })
    .eq('id', command.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (claimError || !claimed) {
    return res.status(409).json({ error: 'El comando ya está siendo procesado por otro worker.' });
  }

  try {
    const toolArguments = buildQuotationToolArguments(command.payload, config);
    const mcpResult = await orbitMcpClient.callTool('siigo_create_quotation', toolArguments);
    const reference = extractQuotationReference(mcpResult);
    const processedAt = new Date().toISOString();

    const { error: completeError } = await supabase
      .from('integration_outbox')
      .update({
        status: 'completed',
        processed_at: processedAt,
        next_attempt_at: processedAt,
        last_error: null,
        siigo_response: mcpResult,
      })
      .eq('id', command.id)
      .eq('status', 'processing');

    if (completeError) throw completeError;

    const quoteUpdate = {
      siigo_sync_status: 'synced',
      siigo_last_error: null,
      siigo_synced_at: processedAt,
      updated_at: processedAt,
    };
    if (reference.id) quoteUpdate.siigo_quotation_id = reference.id;
    if (reference.number) quoteUpdate.siigo_quotation_number = reference.number;

    const { error: quoteError } = await supabase
      .from('cotizaciones')
      .update(quoteUpdate)
      .eq('id', command.local_record_id);

    if (quoteError) throw quoteError;

    if (reference.id) {
      await supabase.from('siigo_entity_map').upsert({
        entity_type: 'quotation',
        local_record_id: command.local_record_id,
        siigo_id: reference.id,
        siigo_code: reference.number,
        last_synced_at: processedAt,
        sync_status: 'synced',
        source_of_truth: 'panel',
      }, { onConflict: 'entity_type,local_record_id' });
    }

    return res.status(200).json({
      status: 'completed',
      outbox_id: command.id,
      siigo_quotation_id: reference.id,
      siigo_quotation_number: reference.number,
    });
  } catch (error) {
    const attempts = command.attempts + 1;
    const isTerminal = attempts >= MAX_ATTEMPTS;
    const nextAttemptAt = new Date(Date.now() + Math.min(60_000 * (2 ** attempts), 30 * 60_000)).toISOString();
    const safeError = error?.message || 'Error desconocido procesando cotización.';

    await supabase
      .from('integration_outbox')
      .update({
        status: isTerminal ? 'dead_letter' : 'failed',
        last_error: safeError.slice(0, 500),
        next_attempt_at: nextAttemptAt,
      })
      .eq('id', command.id)
      .eq('status', 'processing');

    await supabase
      .from('cotizaciones')
      .update({
        siigo_sync_status: 'failed',
        siigo_last_error: safeError.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', command.local_record_id);

    logger.logError('Siigo quotation outbox', 'No se pudo procesar un comando aprobado.', {
      outboxId: command.id,
      correlationId: command.correlation_id,
      attempts,
    });

    return res.status(502).json({
      error: 'No se pudo crear la cotización en Siigo.',
      retryable: !isTerminal,
      outbox_id: command.id,
    });
  }
});

module.exports = {
  buildQuotationToolArguments,
  extractQuotationReference,
  router,
};
