const test = require('node:test');
const assert = require('node:assert/strict');

const {
  areUnsafeDirectSiigoWritesEnabled,
  isMcpToolReadOnly,
  unsafeDirectSiigoWriteGate,
} = require('./siigo-write-gate');

const createResponse = () => ({
  statusCode: null,
  body: null,
  headers: {},
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test.afterEach(() => {
  delete process.env.UNSAFE_DIRECT_SIIGO_WRITES_ENABLED;
});

test('bloquea POST por defecto', () => {
  const response = createResponse();
  let nextCalled = false;

  unsafeDirectSiigoWriteGate({ method: 'POST' }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'UNSAFE_DIRECT_SIIGO_WRITES_DISABLED');
});

test('permite lecturas aunque el bloqueo esté activo', () => {
  const response = createResponse();
  let nextCalled = false;

  unsafeDirectSiigoWriteGate({ method: 'GET' }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});

test('solo habilita escrituras con valor exacto true', () => {
  process.env.UNSAFE_DIRECT_SIIGO_WRITES_ENABLED = 'true';
  assert.equal(areUnsafeDirectSiigoWritesEnabled(), true);

  const response = createResponse();
  let nextCalled = false;
  unsafeDirectSiigoWriteGate({ method: 'PUT' }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('clasifica tools MCP conservadoramente', () => {
  assert.equal(isMcpToolReadOnly({ name: 'siigo_get_products' }), true);
  assert.equal(isMcpToolReadOnly({ name: 'siigo_create_customer' }), false);
  assert.equal(isMcpToolReadOnly({ name: 'siigo_unknown_action' }), false);
  assert.equal(isMcpToolReadOnly({ name: 'custom', annotations: { readOnlyHint: true } }), true);
});
