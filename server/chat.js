const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const orbitMcpClient = require('./orbit-mcp-client');
const logger = require('./logger');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Define allowed tools for each role
const rolePermissions = {
  solo_lectura: ['siigo_get_products', 'siigo_get_product', 'siigo_search_products', 'siigo_get_customers', 'siigo_get_customer', 'siigo_search_customers', 'siigo_get_quotations', 'siigo_get_quotation', 'siigo_get_warehouses', 'siigo_get_price_lists', 'siigo_get_document_types', 'siigo_get_taxes', 'siigo_get_payment_types', 'siigo_get_cost_centers', 'siigo_get_users', 'siigo_get_cities', 'siigo_get_id_types', 'siigo_get_fiscal_responsibilities', 'siigo_get_fixed_assets', 'siigo_get_expenses', 'siigo_get_misc_income'],
  ventas: ['siigo_get_products', 'siigo_get_product', 'siigo_search_products', 'siigo_get_customers', 'siigo_get_customer', 'siigo_search_customers', 'siigo_get_quotations', 'siigo_get_quotation', 'siigo_create_quotation', 'siigo_update_quotation', 'siigo_get_warehouses', 'siigo_get_price_lists', 'siigo_get_document_types', 'siigo_get_taxes', 'siigo_get_payment_types', 'siigo_get_cost_centers', 'siigo_get_users', 'siigo_get_cities', 'siigo_get_id_types', 'siigo_get_fiscal_responsibilities', 'siigo_get_fixed_assets', 'siigo_get_expenses', 'siigo_get_misc_income'],
  bodega: ['siigo_get_products', 'siigo_get_product', 'siigo_search_products', 'siigo_get_customers', 'siigo_get_customer', 'siigo_search_customers', 'siigo_create_product', 'siigo_update_product', 'siigo_create_customer', 'siigo_update_customer', 'siigo_get_quotations', 'siigo_get_quotation', 'siigo_get_warehouses', 'siigo_get_price_lists', 'siigo_get_document_types', 'siigo_get_taxes', 'siigo_get_payment_types', 'siigo_get_cost_centers', 'siigo_get_users', 'siigo_get_cities', 'siigo_get_id_types', 'siigo_get_fiscal_responsibilities', 'siigo_get_fixed_assets', 'siigo_get_expenses', 'siigo_get_misc_income'],
  inventario: ['siigo_get_products', 'siigo_get_product', 'siigo_search_products', 'siigo_get_customers', 'siigo_get_customer', 'siigo_search_customers', 'siigo_create_product', 'siigo_update_product', 'siigo_create_customer', 'siigo_update_customer', 'siigo_get_quotations', 'siigo_get_quotation', 'siigo_get_warehouses', 'siigo_get_price_lists', 'siigo_get_document_types', 'siigo_get_taxes', 'siigo_get_payment_types', 'siigo_get_cost_centers', 'siigo_get_users', 'siigo_get_cities', 'siigo_get_id_types', 'siigo_get_fiscal_responsibilities', 'siigo_get_fixed_assets', 'siigo_get_expenses', 'siigo_get_misc_income'],
  administrador: ['*'] // all tools
};

const requiresConfirmation = (toolName) => {
  return toolName.includes('create') || toolName.includes('update') || toolName.includes('delete');
};

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  
  // Get role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  req.role = profile?.role || 'solo_lectura';

  next();
};

const convertMcpToolToOpenAITool = (tool) => {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || `Siigo tool: ${tool.name}`,
      parameters: tool.inputSchema
    }
  };
};

const SYSTEM_PROMPT = `Eres el "Asistente Ferriperfiles", un experto operativo integrado en el panel de administración. 
Ayudas al equipo a consultar y operar Siigo y la base de datos local sincronizada a través de herramientas (tools).
Responde SIEMPRE en español colombiano de forma clara, directa y profesional.

Reglas críticas:
1. Para responder a consultas de información sobre productos (existencias, stock, precios, códigos) o clientes (NIT, teléfonos, correos, nombres, dirección), usa exclusivamente las herramientas de base de datos local ("db_search_products" y "db_search_customers"). NO utilices las herramientas de lectura de Siigo (MCP) para esto, ya que el panel está sincronizado y es más rápido.
2. Solo debes utilizar las herramientas de Siigo (MCP) para tareas que requieran CREAR o ACTUALIZAR datos (como crear clientes en Siigo, actualizar precios en Siigo, o generar cotizaciones).
3. Si un usuario te pide actualizar el stock (existencias) directamente, explícale claramente que "Siigo no expone un método público (endpoint) para fijar el stock directamente. Las existencias se actualizan a través de documentos de inventario (compras, ventas, ajustes)."
4. Si creas una cotización, muestra claramente el ID y Número de cotización que retorna Siigo.
5. Para listar productos o clientes, muestra un resumen amigable. El frontend lo renderizará como tarjetas si la respuesta es estructurada, pero tú responde el resumen en texto.
6. No pidas confirmación tú mismo: el sistema lo hará automáticamente si usas herramientas de escritura de Siigo.
`;

router.post('/', authMiddleware, async (req, res) => {
  const { message, history, conversation_id, confirmed_action } = req.body;
  
  if (message && message.length > 4000) {
    return res.status(400).json({ error: 'El mensaje es demasiado largo.' });
  }

  try {
    const tools = await orbitMcpClient.listTools();
    const userRole = req.role;
    
    // Filter tools by role
    const allowedTools = tools.filter(t => {
      const hasPermission = rolePermissions[userRole]?.includes('*') || rolePermissions[userRole]?.includes(t.name);
      if (!hasPermission) return false;
      
      // Exclude read-only MCP tools for products and clients to force using local DB
      const isReadOnlyMcpProductOrClient = 
        t.name.startsWith('siigo_list_products') ||
        t.name.startsWith('siigo_get_product') ||
        t.name.startsWith('siigo_search_products') ||
        t.name.startsWith('siigo_list_customers') ||
        t.name.startsWith('siigo_get_customer') ||
        t.name.startsWith('siigo_search_customers');
      
      return !isReadOnlyMcpProductOrClient;
    });

    // If there is a confirmed action from the user, execute it directly
    if (confirmed_action) {
      const { tool_name, tool_args } = confirmed_action;
      
      // Validate again to be sure
      if (!rolePermissions[userRole]?.includes('*') && !rolePermissions[userRole]?.includes(tool_name)) {
        return res.status(403).json({ error: 'No tienes permiso para ejecutar esta acción.' });
      }

      console.log(`Executing confirmed action: ${tool_name}`);
      let result;
      try {
        result = await orbitMcpClient.callTool(tool_name, tool_args);
      } catch (err) {
        console.error(`Error in tool ${tool_name}:`, err);
        logger.logError('Orbit MCP Tool (Confirmed)', `Fallo al ejecutar herramienta ${tool_name}`, {
          arguments: tool_args,
          error: err.message || err,
          stack: err.stack,
          user: req.user?.email
        });
        return res.json({
          role: 'assistant',
          content: `Hubo un error de conexión con Siigo al intentar ejecutar la acción: ${err.message}. Por favor revisa los datos o consulta el Panel de Logs.`
        });
      }

      // Add to conversation
      const conversationHistory = history || [];
      conversationHistory.push({ role: 'assistant', content: null, tool_calls: [{ id: 'call_confirmed', type: 'function', function: { name: tool_name, arguments: JSON.stringify(tool_args) } }] });
      conversationHistory.push({ role: 'tool', tool_call_id: 'call_confirmed', name: tool_name, content: JSON.stringify(result) });
      
      // Generate final response based on tool result
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...conversationHistory
        ],
      });

      return res.json({
        role: 'assistant',
        content: completion.choices[0].message.content
      });
    }

    // Normal chat flow
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(history || []),
      { role: 'user', content: message }
    ];

    const dbTools = [
      {
        type: 'function',
        function: {
          name: 'db_search_products',
          description: 'Busca productos en la base de datos local del panel. Úsalo para responder preguntas sobre existencias (stock), precios de venta o descripciones de productos de Ferriperfiles.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Texto a buscar (nombre del producto o SKU/código).'
              }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'db_search_customers',
          description: 'Busca clientes en la base de datos local del panel. Úsalo para responder cualquier pregunta sobre información de clientes, NIT/cédula, correos, teléfonos o direcciones.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Texto a buscar (nombre/razón social, NIT/cédula o email).'
              }
            },
            required: ['query']
          }
        }
      }
    ];

    const openaiTools = [
      ...dbTools,
      ...allowedTools.map(convertMcpToolToOpenAITool)
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      tool_choice: 'auto'
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls) {
      // Process tool calls
      const toolCall = responseMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      if (toolName === 'db_search_products') {
        try {
          const { query } = toolArgs;
          const { data, error } = await supabase
            .from('productos')
            .select('*')
            .or(`code.ilike.%${query}%,nombre.ilike.%${query}%`)
            .limit(25);
          
          if (error) throw error;
          
          messages.push(responseMessage);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(data || [])
          });

          const finalCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
          });

          return res.json({
            role: 'assistant',
            content: finalCompletion.choices[0].message.content,
            executed_tool: toolName
          });
        } catch (err) {
          console.error('Error in db_search_products:', err);
          logger.logError('DB Search Products', err.message || err, err.stack);
          return res.json({
            role: 'assistant',
            content: `Lo siento, hubo un problema al consultar la base de datos de productos: ${err.message}`
          });
        }
      }

      if (toolName === 'db_search_customers') {
        try {
          const { query } = toolArgs;
          const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .or(`name.ilike.%${query}%,identification.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(25);
          
          if (error) throw error;
          
          messages.push(responseMessage);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(data || [])
          });

          const finalCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
          });

          return res.json({
            role: 'assistant',
            content: finalCompletion.choices[0].message.content,
            executed_tool: toolName
          });
        } catch (err) {
          console.error('Error in db_search_customers:', err);
          logger.logError('DB Search Customers', err.message || err, err.stack);
          return res.json({
            role: 'assistant',
            content: `Lo siento, hubo un problema al consultar la base de datos de clientes: ${err.message}`
          });
        }
      }

      if (requiresConfirmation(toolName)) {
        // Need user confirmation before executing
        return res.json({
          role: 'assistant',
          content: 'Por favor, confirma la siguiente operación:',
          requires_confirmation: true,
          action_details: {
            tool_name: toolName,
            tool_args: toolArgs,
            summary: `Vas a ejecutar la acción de escritura: **${toolName}** en Siigo.`
          }
        });
      } else {
        // Safe to execute immediately (Read-only)
        try {
          const result = await orbitMcpClient.callTool(toolName, toolArgs);
          
          messages.push(responseMessage);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(result)
          });

          const finalCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
          });

          return res.json({
            role: 'assistant',
            content: finalCompletion.choices[0].message.content,
            executed_tool: toolName
          });

        } catch (err) {
          console.error(`Error in tool ${toolName}:`, err);
          logger.logError('Orbit MCP Tool (Safe)', `Fallo al ejecutar herramienta de lectura ${toolName}`, {
            arguments: toolArgs,
            error: err.message || err,
            stack: err.stack,
            user: req.user?.email
          });
          return res.json({
            role: 'assistant',
            content: `Lo siento, hubo un problema al consultar Siigo (${err.message}). Intenta más tarde o revisa el Panel de Logs.`
          });
        }
      }
    }

    return res.json({
      role: 'assistant',
      content: responseMessage.content
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    logger.logError('Chat API', error.message || 'Error en chat', {
      stack: error.stack,
      user: req.user?.email,
      messageLength: message?.length
    });
    res.status(500).json({ error: 'Internal server error during chat processing' });
  }
});

module.exports = router;
