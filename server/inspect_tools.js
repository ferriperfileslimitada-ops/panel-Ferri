const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const urlStr = process.env.ORBIT_MCP_URL || 'https://siigo.adsbigger.cloud/mcp/3334ff19-664c-442d-ad0f-a9308c8d4cab';
const apiKey = process.env.ORBIT_MCP_API_KEY;

async function run() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const url = new URL(urlStr);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers }
  });

  const client = new Client({ name: 'inspect', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  
  const response = await client.listTools();
  const customerTool = response.tools.find(t => t.name === 'siigo_create_customer');
  const quotationTool = response.tools.find(t => t.name === 'siigo_create_quotation');
  
  console.log('--- CUSTOMER TOOL SCHEMA ---');
  console.log(JSON.stringify(customerTool, null, 2));

  console.log('\n--- QUOTATION TOOL SCHEMA ---');
  console.log(JSON.stringify(quotationTool, null, 2));

  await client.close();
}

run().catch(console.error);
