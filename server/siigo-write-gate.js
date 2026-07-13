const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const areUnsafeDirectSiigoWritesEnabled = () =>
  process.env.UNSAFE_DIRECT_SIIGO_WRITES_ENABLED === 'true';

const unsafeDirectSiigoWriteGate = (req, res, next) => {
  if (!WRITE_METHODS.has(String(req.method || '').toUpperCase())) {
    return next();
  }

  if (areUnsafeDirectSiigoWritesEnabled()) {
    return next();
  }

  res.set('Cache-Control', 'no-store');
  return res.status(503).json({
    error: 'Las escrituras directas hacia Siigo están desactivadas temporalmente.',
    code: 'UNSAFE_DIRECT_SIIGO_WRITES_DISABLED',
  });
};

const isMcpToolReadOnly = (tool) => {
  if (tool?.annotations?.readOnlyHint === true) return true;
  return /^siigo_(get|list|search)_/.test(String(tool?.name || ''));
};

module.exports = {
  areUnsafeDirectSiigoWritesEnabled,
  isMcpToolReadOnly,
  unsafeDirectSiigoWriteGate,
};
