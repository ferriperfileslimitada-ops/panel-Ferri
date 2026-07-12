const express = require('express');
const { createSiigoCustomer, createSiigoQuotation, updateSiigoQuotation } = require('./siigo');

const router = express.Router();

router.post('/customers', async (req, res) => {
  try {
    const data = await createSiigoCustomer(req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/quotations', async (req, res) => {
  try {
    const data = await createSiigoQuotation(req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/quotations/:id', async (req, res) => {
  try {
    const data = await updateSiigoQuotation(req.params.id, req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
