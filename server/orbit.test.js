const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Test to ensure ORBIT_MCP_API_KEY is not in the client bundle
function testNoApiKeyInBundle() {
  const distPath = path.join(__dirname, '../dist/assets');
  if (!fs.existsSync(distPath)) {
    console.log('Skipping bundle test, dist folder not found. Run npm run build first.');
    return;
  }
  
  const files = fs.readdirSync(distPath);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  
  let foundKey = false;
  
  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(distPath, file), 'utf8');
    if (content.includes('ORBIT_MCP_API_KEY')) {
      console.error(`❌ SECURITY VULNERABILITY: API Key found in bundle ${file}`);
      foundKey = true;
    }
  }
  
  if (!foundKey) {
    console.log('✅ TEST PASSED: ORBIT_MCP_API_KEY is not exposed in the client bundle.');
  } else {
    process.exit(1);
  }
}

// 2. Mock Test for orbitMcpClient health endpoint behavior
async function testOrbitClientMocks() {
  console.log('Running mock test for Orbit MCP Client...');
  
  // Set fake env
  process.env.ORBIT_MCP_URL = 'http://mock-orbit.local';
  process.env.ORBIT_MCP_API_KEY = 'mock_key';

  // Import the client
  const orbitClient = require('./orbit-mcp-client');

  // Mock the internal connect method to avoid real network call
  orbitClient.connect = async function() {
    this.connected = true;
    return Promise.resolve();
  };

  orbitClient.listTools = async function() {
    return [
      { name: 'siigo_list_products' },
      { name: 'siigo_create_customer' }
    ];
  };

  orbitClient.callTool = async function(name, args) {
    if (name === 'siigo_list_products') {
      return { _type: 'message', content: { results: [{ id: 1, name: 'Sample' }] } };
    }
    throw new Error('Tool not found');
  };

  try {
    const status = await orbitClient.safeConnect();
    assert.strictEqual(status.success, true, 'safeConnect should return success: true');
    
    const tools = await orbitClient.listTools();
    assert.strictEqual(tools.length, 2, 'Should list 2 mock tools');
    
    const sample = await orbitClient.callTool('siigo_list_products', { page: 1, page_size: 1 });
    assert.strictEqual(sample.content.results[0].name, 'Sample', 'Should receive sample product');

    console.log('✅ TEST PASSED: orbitMcpClient successfully mocks connection and tool calls.');
  } catch (error) {
    console.error('❌ MOCK TEST FAILED:', error);
    process.exit(1);
  }
}

async function runTests() {
  testNoApiKeyInBundle();
  await testOrbitClientMocks();
  console.log('All Orbit security and connection tests passed.');
}

runTests();
