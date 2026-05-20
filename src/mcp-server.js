import 'dotenv/config';
import express from 'express';
import coolifyClient from './coolify.js';
import auth from './auth.js';

const PORT = process.env.MCP_SERVER_PORT || 3000;
const HOST = process.env.MCP_SERVER_HOST || '0.0.0.0';

console.log('=== MCP Server (Standard Protocol) Starting ===');
console.log('COOLIFY_URL:', process.env.COOLIFY_URL ? '***SET***' : 'NOT SET');
console.log('COOLIFY_API_TOKEN:', process.env.COOLIFY_API_TOKEN ? '***SET***' : 'NOT SET');
console.log('AUTH_SECRET:', process.env.AUTH_SECRET ? '***SET***' : 'NOT SET');

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

// Exécuteurs des outils
const toolHandlers = {
  list_projects: async (args) => {
    console.log('[TOOL] list_projects executing');
    return await coolifyClient.listProjects();
  },
  get_project: async (args) => {
    console.log('[TOOL] get_project executing with:', args);
    return await coolifyClient.getProject(args.projectId);
  },
  list_services: async (args) => {
    console.log('[TOOL] list_services executing with:', args);
    return await coolifyClient.listServices(args.projectId);
  },
  deploy_service: async (args) => {
    console.log('[TOOL] deploy_service executing with:', args);
    return await coolifyClient.deployService(args.projectId, args.serviceId, args.force);
  },
  get_service_logs: async (args) => {
    console.log('[TOOL] get_service_logs executing with:', args);
    return await coolifyClient.getServiceLogs(args.projectId, args.serviceId, args.lines);
  },
};

// Créer le serveur Express
const app = express();
app.use(express.json());

// Middleware d'authentification
app.use(async (req, res, next) => {
  console.log('[MIDDLEWARE] Auth check for:', req.path);
  try {
    const authOk = await auth.verifyRequest(req);
    if (!authOk) {
      console.log('[MIDDLEWARE] Auth failed');
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized' },
        id: req.body.id || null
      });
    }
    console.log('[MIDDLEWARE] Auth successful');
    next();
  } catch (error) {
    console.error('[MIDDLEWARE] Auth error:', error.message);
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: error.message },
      id: req.body.id || null
    });
  }
});

// Endpoint santé (non MCP)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint MCP principal - gère toutes les requêtes JSON-RPC
app.post('/', async (req, res) => {
  console.log('[MCP] Received request:', req.body);
  
  try {
    const { jsonrpc, method, params, id } = req.body;
    
    // Validation JSON-RPC
    if (jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid JSON-RPC version' },
        id
      });
    }
    
    if (!method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Method is required' },
        id
      });
    }
    
    // Gestion des méthodes MCP
    if (method === 'tools/list') {
      console.log('[MCP] tools/list called');
      const toolsList = Object.values(tools).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
      console.log('[MCP] Returning', toolsList.length, 'tools');
      return res.json({
        jsonrpc: '2.0',
        result: { tools: toolsList },
        id
      });
    }
    
    if (method.startsWith('tools/call/')) {
      const toolName = method.replace('tools/call/', '');
      console.log('[MCP] tools/call/', toolName, 'called with params:', params);
      
      const tool = tools[toolName];
      if (!tool) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id
        });
      }
      
      const handler = toolHandlers[toolName];
      if (!handler) {
        return res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error: no handler' },
          id
        });
      }
      
      try {
        const result = await handler(params?.arguments || {});
        console.log('[MCP] Tool result:', result);
        return res.json({
          jsonrpc: '2.0',
          result,
          id
        });
      } catch (error) {
        console.error('[MCP] Tool execution error:', error);
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32603, message: error.message },
          id
        });
      }
    }
    
    // Méthode non supportée
    return res.status(404).json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id
    });
    
  } catch (error) {
    console.error('[MCP] Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: error.message },
      id: null
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log('=== MCP Server (JSON-RPC) running on http://' + HOST + ':' + PORT + ' ===');
});

console.log('=== Server initialization complete ===');