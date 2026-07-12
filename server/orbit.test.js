const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Static analysis of orbit-mcp-client.js to ensure no SSE imports
function testStaticAnalysis() {
  console.log('Running static analysis on orbit-mcp-client.js...');
  const clientPath = path.join(__dirname, 'orbit-mcp-client.js');
  const code = fs.readFileSync(clientPath, 'utf8');

  // Verify StreamableHTTP is imported
  const hasStreamableImport = code.includes('@modelcontextprotocol/sdk/client/streamableHttp.js') || 
                               code.includes('StreamableHTTPClientTransport');
  assert.strictEqual(hasStreamableImport, true, 'orbit-mcp-client.js must import StreamableHTTPClientTransport');

  // Verify SSE is NOT imported
  const hasSseImport = code.includes('client/sse.js') || code.includes('SSEClientTransport') || code.includes('EventSource');
  assert.strictEqual(hasSseImport, false, 'orbit-mcp-client.js must NOT import or reference SSE Client Transport or EventSource');

  console.log('✅ TEST PASSED: No SSE imports found. StreamableHTTPClientTransport is used.');
}

// 2. Test to ensure ORBIT_MCP_API_KEY is not in the client bundle
function testNoApiKeyInBundle() {
  console.log('Running client bundle security check...');
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

// 3. Mock Test for orbitMcpClient health endpoint behavior
async function testOrbitClientMocks() {
  console.log('Running mock test for Orbit MCP Client...');
  
  // Save original env
  const origUrl = process.env.ORBIT_MCP_URL;
  const origKey = process.env.ORBIT_MCP_API_KEY;
  
  // Set fake env
  process.env.ORBIT_MCP_URL = 'http://mock-orbit.local';
  process.env.ORBIT_MCP_API_KEY = 'mock_key';

  // Import the client
  const orbitClient = require('./orbit-mcp-client');

  // Mock the internal connect method to avoid real network call
  const originalConnect = orbitClient.connect;
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
  } finally {
    // Restore
    process.env.ORBIT_MCP_URL = origUrl;
    process.env.ORBIT_MCP_API_KEY = origKey;
    orbitClient.connect = originalConnect;
    delete require.cache[require.resolve('./orbit-mcp-client')];
  }
}

// 4. Live Connection Test (Runs only if real env variables are present)
async function testLiveConnection() {
  // Try loading real env if dotenv exists
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.join(__dirname, '../.env') });
  } catch (e) {}

  const url = process.env.ORBIT_MCP_URL;
  const apiKey = process.env.ORBIT_MCP_API_KEY;

  if (!url || !apiKey || url.includes('mock-orbit')) {
    console.log('Skipping live connection test (Real ORBIT_MCP_URL and ORBIT_MCP_API_KEY not found in environment).');
    return;
  }

  console.log('Running live connection test to Orbit MCP...');
  console.log(`URL: ${url}`);
  
  // Re-import the client fresh
  const orbitClient = require('./orbit-mcp-client');

  try {
    const status = await orbitClient.safeConnect();
    if (!status.success) {
      throw new Error(`Connection failed: ${status.error}`);
    }
    console.log('✅ safeConnect succeeded on live server!');

    const tools = await orbitClient.listTools();
    console.log(`✅ listTools succeeded. Found ${tools.length} tools.`);

    const productsTool = tools.find(t => t.name === 'siigo_list_products');
    assert.ok(productsTool, 'Orbit MCP should expose siigo_list_products tool');

    console.log('Calling siigo_list_products tool...');
    const result = await orbitClient.callTool('siigo_list_products', { page: 1, page_size: 1 });
    assert.ok(result, 'Tool execution should return a response');
    console.log('✅ siigo_list_products succeeded on live server!');
    
    console.log('✅ TEST PASSED: Live connection and tools execution succeeded.');
  } catch (err) {
    console.error('❌ LIVE TEST FAILED:', err.message || err);
    process.exit(1);
  }
}

async function runTests() {
  testStaticAnalysis();
  testNoApiKeyInBundle();
  await testOrbitClientMocks();
  await testLiveConnection();
  console.log('All Orbit integration tests completed successfully.');
}

runTests();
