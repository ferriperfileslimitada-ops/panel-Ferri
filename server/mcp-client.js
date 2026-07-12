const dotenv = require('dotenv');

dotenv.config();

class MCPClientManager {
  constructor() {
    this.client = null;
    this.transport = null;
    this.connected = false;
    this.connectionPromise = null;
  }

  async connect() {
    if (this.connected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = (async () => {
      try {
        // Dynamic import because @modelcontextprotocol/sdk is ESM only
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

        // URL must point to the Streamable HTTP endpoint, usually just /mcp or similar.
        // We'll replace /sse with /mcp if it exists in the url.
        let urlStr = process.env.ORBIT_MCP_URL || 'https://siigo.adsbigger.cloud/mcp';
        urlStr = urlStr.replace(/\/sse\/?$/, '/mcp'); 
        
        const apiKey = process.env.ORBIT_MCP_API_KEY;

        const headers = {};
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const url = new URL(urlStr);

        this.transport = new StreamableHTTPClientTransport(url, {
          requestInit: {
            headers,
          },
        });

        this.client = new Client(
          {
            name: 'ferriperfiles-dashboard',
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        await this.client.connect(this.transport);
        this.connected = true;
        console.log('MCP Client connected to', url.toString(), 'via StreamableHTTP');
      } catch (error) {
        this.connectionPromise = null;
        console.error('Failed to connect MCP Client:', error);
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  async callTool(name, args) {
    await this.connect();
    
    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });
      return result;
    } catch (error) {
      console.error(`MCP Tool call failed [${name}]:`, error);
      throw error;
    }
  }

  async listTools() {
    await this.connect();
    try {
      const response = await this.client.listTools();
      return response.tools || [];
    } catch (error) {
      console.error('Failed to list MCP tools:', error);
      throw error;
    }
  }
}

// Singleton instance
const mcpManager = new MCPClientManager();

module.exports = {
  mcpManager,
};
