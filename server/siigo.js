const dotenv = require('dotenv');
dotenv.config();

let siigoToken = null;
let tokenExpiresAt = null;

async function getSiigoToken() {
  if (siigoToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return siigoToken;
  }

  const username = process.env.SIIGO_USERNAME;
  const access_key = process.env.SIIGO_ACCESS_KEY;

  if (!username || !access_key) {
    throw new Error("Credenciales de Siigo no configuradas (SIIGO_USERNAME, SIIGO_ACCESS_KEY)");
  }

  const response = await fetch('https://api.siigo.com/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, access_key })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error autenticando con Siigo: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  siigoToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;
  
  return siigoToken;
}

async function createSiigoCustomer(customerData) {
  const token = await getSiigoToken();
  const response = await fetch('https://api.siigo.com/v1/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(customerData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error creando cliente en Siigo: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function updateSiigoCustomer(id, customerData) {
  const token = await getSiigoToken();
  const response = await fetch(`https://api.siigo.com/v1/customers/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(customerData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error actualizando cliente en Siigo: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function createSiigoQuotation(quoteData) {
  const token = await getSiigoToken();
  const response = await fetch('https://api.siigo.com/v1/quotations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(quoteData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error creando cotización en Siigo: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function updateSiigoQuotation(id, quoteData) {
  const token = await getSiigoToken();
  const response = await fetch(`https://api.siigo.com/v1/quotations/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(quoteData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error actualizando cotización en Siigo: ${response.status} ${errorText}`);
  }

  return await response.json();
}

module.exports = {
  createSiigoCustomer,
  updateSiigoCustomer,
  createSiigoQuotation,
  updateSiigoQuotation
};
