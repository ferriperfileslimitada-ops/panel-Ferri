const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildQuotationToolArguments,
  extractQuotationReference,
} = require('./siigo-outbox-worker');

const config = {
  quotationDocumentId: 12345,
  sellerId: 629,
  branchOffice: 0,
  taxId: 13156,
};

test('convierte un comando aprobado al contrato de siigo_create_quotation', () => {
  const args = buildQuotationToolArguments({
    date: '2026-07-13',
    customer_identification: '900133263',
    notes: 'Entrega parcial',
    items: [{ code: 'PERFIL-01', quantity: 2, price: 50000 }],
  }, config);

  assert.deepEqual(args, {
    quotation: {
      document: { id: 12345 },
      date: '2026-07-13',
      customer: { identification: '900133263', branch_office: 0 },
      seller: 629,
      items: [{ code: 'PERFIL-01', quantity: 2, price: 50000, taxes: [{ id: 13156 }] }],
      observations: 'Entrega parcial',
    },
  });
});

test('rechaza un comando sin cliente o ítems válidos', () => {
  assert.throws(() => buildQuotationToolArguments({ items: [] }, config), /cliente e ítems válidos/);
});

test('extrae la referencia cuando el MCP devuelve contenido estructurado', () => {
  assert.deepEqual(extractQuotationReference({
    structuredContent: { id: 'quote-1', name: 'C-100' },
  }), { id: 'quote-1', number: 'C-100' });
});
