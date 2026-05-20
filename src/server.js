import 'dotenv/config';
import express from 'express';
import coolifyClient from './coolify.js';
import auth from './auth.js';

const PORT = process.env.MCP_SERVER_PORT || 3000;
const HOST = process.env.MCP_SERVER_HOST || '0.0.0.0';

console.log('=== MCP Server (Hybrid Mode) Starting ===');
console.log('COOLIFY_URL:', process.env.COOLIFY_URL ? '***SET***' : 'NOT SET');
console.log('COOLIFY_API_TOKEN:', process.env.COOLIFY_API_TOKEN ? '***SET***' : 'NOT SET');
console.log('AUTH_SECRET:', process.env.AUTH_SECRET ? '***SET***' : 'NOT SET');
console.log('MCP_SERVER_PORT:', PORT);
console.log('MCP_SERVER_HOST:', HOST);
console.log('=== All environment variables loaded ===');

// Définition des outils
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
const executeTool = async (toolName, params, req) => {
  console.log(`[EXECUTE] Tool: ${toolName}, Params:`, params);
  
  const tool = tools[toolName];
  if (!tool) {
    throw new Error('Tool not found: ' + toolName);
  }
  
  // Vérification auth pour les appels directs
  if (req) {
    const authOk = await auth.verifyRequest(req);
    if (!authOk) {
      throw new Error('Unauthorized');
    }
  }
  
  try {
    if (toolName === 'list_projects') {
      return await coolifyClient.listProjects();
    }
    if (toolName === 'get_project') {
      return await coolifyClient.getProject(params.projectId);
    }
    if (toolName === 'list_services') {
      return await coolifyClient.listServices(params.projectId);
    }
    if (toolName === 'deploy_service') {
      return await coolifyClient.deployService(params.projectId, params.serviceId, params.force);
    }
    if (toolName === 'get_service_logs') {
      return await coolifyClient.getServiceLogs(params.projectId, params.serviceId, params.lines);
    }
    throw new Error('Unknown tool: ' + toolName);
  } catch (error) {
    console.error(`[EXECUTE ERROR] Tool ${toolName}:`, error.message);
    throw error;
  }
};

// Créer le serveur Express
const app = express();
app.use(express.json());

// Middleware de log pour TOUTES les requêtes
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  console.log('[HTTP] Headers:', Object.keys(req.headers).join(', '));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('[HTTP] Body:', JSON.stringify(req.body));
  }
  next();
});

// ===== ENDPOINT CUSTOM (pour curl) =====
// GET /mcp/tools - Liste les outils
app.get('/mcp/tools', async (req, res) => {
  console.log('[CUSTOM] GET /mcp/tools - Listing tools');
  try {
    const authOk = await auth.verifyRequest(req);
    if (!authOk) {
      console.log('[CUSTOM] Auth failed for /mcp/tools');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const toolsList = Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    console.log('[CUSTOM] Returning', toolsList.length, 'tools');
    res.json({ tools: toolsList });
  } catch (error) {
    console.error('[CUSTOM ERROR] /mcp/tools:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// POST /mcp/tools/:name - Appelle un outil
app.post('/mcp/tools/:name', async (req, res) => {
  console.log(`[CUSTOM] POST /mcp/tools/${req.params.name}`);
  try {
    const authOk = await auth.verifyRequest(req);
    if (!authOk) {
      console.log('[CUSTOM] Auth failed for /mcp/tools/:name');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const toolName = req.params.name;
    const params = req.body;
    console.log('[CUSTOM] Params:', params);
    
    const result = await executeTool(toolName, params, req);
    console.log('[CUSTOM] Result:', result);
    res.json({ result });
  } catch (error) {
    console.error('[CUSTOM ERROR] /mcp/tools/:name:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// ===== ENDPOINT JSON-RPC (pour Mistral) =====
app.post('/', async (req, res) => {
  console.log('[JSON-RPC] POST / - Received request');
  console.log('[JSON-RPC] Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { jsonrpc, method, params, id } = req.body;
    
    // Validation JSON-RPC
    if (jsonrpc !== '2.0') {
      console.log('[JSON-RPC] Invalid version:', jsonrpc);
      return res.json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid JSON-RPC version' },
        id
      });
    }
    
    if (!method) {
      console.log('[JSON-RPC] Method missing');
      return res.json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Method is required' },
        id
      });
    }
    
    console.log(`[JSON-RPC] Method: ${method}, ID: ${id}`);
    
    // Gestion des méthodes MCP
    if (method === 'tools/list') {
      console.log('[JSON-RPC] tools/list called');
      const authOk = await auth.verifyRequest(req);
      if (!authOk) {
        console.log('[JSON-RPC] Auth failed for tools/list');
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Unauthorized' },
          id
        });
      }
      const toolsList = Object.values(tools).map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      console.log('[JSON-RPC] Returning', toolsList.length, 'tools');
      return res.json({
        jsonrpc: '2.0',
        result: { tools: toolsList },
        id
      });
    }
    
    if (method.startsWith('tools/call/')) {
      const toolName = method.replace('tools/call/', '');
      console.log(`[JSON-RPC] tools/call/${toolName} called`);
      console.log('[JSON-RPC] Params:', params);
      
      const authOk = await auth.verifyRequest(req);
      if (!authOk) {
        console.log('[JSON-RPC] Auth failed for tools/call');
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Unauthorized' },
          id
        });
      }
      
      try {
        const result = await executeTool(toolName, params?.arguments || {}, req);
        console.log('[JSON-RPC] Tool result:', result);
        return res.json({
          jsonrpc: '2.0',
          result,
          id
        });
      } catch (error) {
        console.error('[JSON-RPC ERROR] Tool execution:', error.message);
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32603, message: error.message },
          id
        });
      }
    }
    
    // Méthode non supportée
    console.log('[JSON-RPC] Method not found:', method);
    return res.json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id
    });
    
  } catch (error) {
    console.error('[JSON-RPC] Error:', error);
    res.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: error.message },
      id: null
    });
  }
});

// Endpoint santé
app.get('/health', (req, res) => {
  console.log('[HEALTH] GET /health');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'MCP Hybrid Server'
  });
});

// Gestion des 404
app.use((req, res) => {
  console.log('[404] Route not found:', req.method, req.path);
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    availableEndpoints: ['/', '/mcp/tools', '/mcp/tools/:name', '/health']
  });
});

app.listen(PORT, HOST, () => {
  console.log('========================================');
  console.log('=== MCP HYBRID SERVER RUNNING ===');
  console.log('========================================');
  console.log('Custom endpoints:');
  console.log('  GET  /mcp/tools           - List tools');
  console.log('  POST /mcp/tools/:name     - Call tool');
  console.log('');
  console.log('JSON-RPC endpoint (Mistral):');
  console.log('  POST /                    - JSON-RPC requests');
  console.log('');
  console.log('Other:');
  console.log('  GET  /health              - Health check');
  console.log('========================================');
  console.log('URL: http://' + HOST + ':' + PORT);
  console.log('========================================');
});

console.log('=== Server initialization complete ===');