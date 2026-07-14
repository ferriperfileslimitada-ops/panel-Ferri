const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();

class OrbitMCPClientManager {
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
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

        const urlStr = process.env.ORBIT_MCP_URL;
        const apiKey = process.env.ORBIT_MCP_API_KEY;

        if (!urlStr) {
          throw new Error('ORBIT_MCP_URL is not configured');
        }

        if (!apiKey) {
          throw new Error('ORBIT_MCP_API_KEY is not configured');
        }

        const headers = {
          'Content-Type': 'application/json'
        };
        
        headers['Authorization'] = `Bearer ${apiKey}`;

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
        console.log('Orbit MCP Client connected to', url.toString());
      } catch (error) {
        this.connectionPromise = null;
        console.error('Failed to connect Orbit MCP Client:', error.message || error);
        logger.logError('Orbit MCP Client', error.message || 'Fallo de conexión con Orbit MCP', {
          url: process.env.ORBIT_MCP_URL,
          stack: error.stack
        });
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  async safeConnect() {
    try {
      await this.connect();
      return { success: true };
    } catch (error) {
      let message = 'Fallo de conexión con Orbit MCP.';
      if (error.message) {
        if (error.message.includes('401')) message = '401 Unauthorized - Verifica tu ORBIT_MCP_API_KEY.';
        else if (error.message.includes('429')) message = '429 Too Many Requests - Límite de cuota excedido en Orbit.';
        else if (error.message.includes('502') || error.message.includes('503')) message = '502/503 Bad Gateway - Orbit no está disponible.';
        else if (error.message.includes('timeout') || error.message.includes('fetch')) message = 'Error de red o Timeout. Verifica que Orbit MCP es accesible desde este servidor.';
        else message = `Error MCP: ${error.message}`;
      }
      return { success: false, error: message };
    }
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
      console.error(`Orbit MCP Tool call failed [${name}]:`, error);
      throw error;
    }
  }

  async listTools() {
    await this.connect();
    try {
      const response = await this.client.listTools();
      return response.tools || [];
    } catch (error) {
      console.error('Failed to list Orbit MCP tools:', error);
      throw error;
    }
  }
}

const orbitMcpClient = new OrbitMCPClientManager();

module.exports = orbitMcpClient;
