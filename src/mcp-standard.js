import 'dotenv/config';
import express from 'express';
import coolifyClient from './coolify.js';

const PORT = process.env.MCP_SERVER_PORT || 3000;
const HOST = process.env.MCP_SERVER_HOST || '0.0.0.0';

console.log('=== MCP Standard Server Starting ===');
console.log('COOLIFY_URL:', process.env.COOLIFY_URL ? '***SET***' : 'NOT SET');
console.log('COOLIFY_API_TOKEN:', process.env.COOLIFY_API_TOKEN ? '***SET***' : 'NOT SET');

// Définition des outils MCP
const tools = {
  list_projects: {
    name: 'list_projects',
    description: 'Liste tous les projets Coolify',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  get_project: {
    name: 'get_project',
    description: 'Récupère les détails d'un projet Coolify',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
      },
      required: ['projectId'],
    },
  },
  list_services: {
    name: 'list_services',
    description: 'Liste tous les services d'un projet',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
      },
      required: ['projectId'],
    },
  },
  deploy_service: {
    name: 'deploy_service',
    description: 'Déploie un service Coolify',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
        serviceId: { type: 'string', description: 'ID du service à déployer' },
        force: { type: 'boolean', description: 'Forcer le déploiement', default: false },
      },
      required: ['projectId', 'serviceId'],
    },
  },
  get_service_logs: {
    name: 'get_service_logs',
    description: 'Récupère les logs d'un service',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
        serviceId: { type: 'string', description: 'ID du service' },
        lines: { type: 'number', description: 'Nombre de lignes de logs', default: 100 },
      },
      required: ['projectId', 'serviceId'],
    },
  },
};

// Exécuteurs
const executeTool = async (toolName, args) => {
  console.log(`[TOOL] ${toolName} executing with:`, args);
  
  try {
    if (toolName === 'list_projects') {
      return await coolifyClient.listProjects();
    }
    if (toolName === 'get_project') {
      return await coolifyClient.getProject(args.projectId);
    }
    if (toolName === 'list_services') {
      return await coolifyClient.listServices(args.projectId);
    }
    if (toolName === 'deploy_service') {
      return await coolifyClient.deployService(args.projectId, args.serviceId, args.force);
    }
    if (toolName === 'get_service_logs') {
      return await coolifyClient.getServiceLogs(args.projectId, args.serviceId, args.lines);
    }
    throw new Error('Unknown tool: ' + toolName);
  } catch (error) {
    console.error(`[TOOL ERROR] ${toolName}:`, error.message);
    throw error;
  }
};

// Serveur Express
const app = express();
app.use(express.json({ limit: '10mb' }));

// Log ALL requests
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  console.log('[REQ] Headers:', JSON.stringify(Object.keys(req.headers)));
  if (req.body) {
    console.log('[REQ] Body:', JSON.stringify(req.body));
  }
  next();
});

// MCP Standard: POST / with JSON-RPC
app.post('/', async (req, res) => {
  console.log('[MCP] JSON-RPC request received');
  
  try {
    const { jsonrpc, method, params, id } = req.body;
    
    // Validate JSON-RPC 2.0
    if (jsonrpc !== '2.0') {
      console.log('[MCP] Invalid JSON-RPC version');
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid JSON-RPC version' },
        id: id || null
      });
    }
    
    // Handle initialize request (MCP handshake)
    if (method === 'initialize') {
      console.log('[MCP] Initialize request');
      return res.json({
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'coolify-mcp-server',
            version: '1.0.0'
          }
        },
        id: id || 1
      });
    }
    
    // Handle tools/list
    if (method === 'tools/list') {
      console.log('[MCP] tools/list request');
      return res.json({
        jsonrpc: '2.0',
        result: {
          tools: Object.values(tools).map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          }))
        },
        id: id || 1
      });
    }
    
    // Handle tools/call
    if (method.startsWith('tools/call/')) {
      const toolName = method.replace('tools/call/', '');
      console.log(`[MCP] tools/call/${toolName} request`);
      
      const tool = tools[toolName];
      if (!tool) {
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id: id || 1
        });
      }
      
      try {
        const result = await executeTool(toolName, params?.arguments || {});
        console.log(`[MCP] Tool ${toolName} result:`, result);
        return res.json({
          jsonrpc: '2.0',
          result: result,
          id: id || 1
        });
      } catch (error) {
        console.error(`[MCP] Tool ${toolName} error:`, error.message);
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32603, message: error.message },
          id: id || 1
        });
      }
    }
    
    // Method not found
    console.log(`[MCP] Unknown method: ${method}`);
    return res.json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id: id || 1
    });
    
  } catch (error) {
    console.error('[MCP] Error:', error);
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: error.message },
      id: null
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback for old custom endpoints
app.get('/mcp/tools', async (req, res) => {
  console.log('[LEGACY] GET /mcp/tools');
  try {
    const toolsList = Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    res.json({ tools: toolsList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/mcp/tools/:name', async (req, res) => {
  console.log(`[LEGACY] POST /mcp/tools/${req.params.name}`);
  try {
    const toolName = req.params.name;
    const params = req.body;
    const result = await executeTool(toolName, params);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log('========================================');
  console.log('=== MCP STANDARD SERVER RUNNING ===');
  console.log('========================================');
  console.log('Primary endpoint:');
  console.log('  POST /          - JSON-RPC (MCP standard)');
  console.log('');
  console.log('Legacy endpoints:');
  console.log('  GET  /mcp/tools - List tools');
  console.log('  POST /mcp/tools/:name - Call tool');
  console.log('');
  console.log('Other:');
  console.log('  GET  /health   - Health check');
  console.log('========================================');
  console.log('URL: http://' + HOST + ':' + PORT);
  console.log('========================================');
});

console.log('=== Server initialization complete ===');