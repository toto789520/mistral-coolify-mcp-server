import 'dotenv/config';
import express from 'express';
import coolifyClient from './coolify.js';
import auth from './auth.js';

const PORT = process.env.MCP_SERVER_PORT || 3000;
const HOST = process.env.MCP_SERVER_HOST || '0.0.0.0';

console.log('=== MCP Server Starting ===');
console.log('COOLIFY_URL:', process.env.COOLIFY_URL ? '***SET***' : 'NOT SET');
console.log('COOLIFY_API_TOKEN:', process.env.COOLIFY_API_TOKEN ? '***SET***' : 'NOT SET');
console.log('AUTH_SECRET:', process.env.AUTH_SECRET ? '***SET***' : 'NOT SET');
console.log('MCP_SERVER_PORT:', PORT);
console.log('MCP_SERVER_HOST:', HOST);

const tools = {
  list_projects: {
    name: 'list_projects',
    description: 'Liste tous les projets Coolify',
    parameters: { type: 'object', properties: {} },
    handler: async (params) => {
      console.log('[TOOL] list_projects called');
      console.log('[TOOL] list_projects: calling coolifyClient.listProjects');
      return await coolifyClient.listProjects();
    },
  },
  get_project: {
    name: 'get_project',
    description: 'Recupere les details dun projet Coolify',
    parameters: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'ID du projet Coolify' } },
      required: ['projectId'],
    },
    handler: async (params) => {
      console.log('[TOOL] get_project called with:', params);
      console.log('[TOOL] get_project: calling coolifyClient.getProject');
      return await coolifyClient.getProject(params.projectId);
    },
  },
  list_services: {
    name: 'list_services',
    description: 'Liste tous les services dun projet',
    parameters: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'ID du projet Coolify' } },
      required: ['projectId'],
    },
    handler: async (params) => {
      console.log('[TOOL] list_services called with:', params);
      console.log('[TOOL] list_services: calling coolifyClient.listServices');
      return await coolifyClient.listServices(params.projectId);
    },
  },
  deploy_service: {
    name: 'deploy_service',
    description: 'Deploie un service Coolify',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
        serviceId: { type: 'string', description: 'ID du service a deployer' },
        force: { type: 'boolean', description: 'Forcer le deploiement', default: false },
      },
      required: ['projectId', 'serviceId'],
    },
    handler: async (params) => {
      console.log('[TOOL] deploy_service called with:', params);
      console.log('[TOOL] deploy_service: calling coolifyClient.deployService');
      return await coolifyClient.deployService(params.projectId, params.serviceId, params.force);
    },
  },
  get_service_logs: {
    name: 'get_service_logs',
    description: 'Recupere les logs dun service',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
        serviceId: { type: 'string', description: 'ID du service' },
        lines: { type: 'number', description: 'Nombre de lignes de logs', default: 100 },
      },
      required: ['projectId', 'serviceId'],
    },
    handler: async (params) => {
      console.log('[TOOL] get_service_logs called with:', params);
      console.log('[TOOL] get_service_logs: calling coolifyClient.getServiceLogs');
      return await coolifyClient.getServiceLogs(params.projectId, params.serviceId, params.lines);
    },
  },
};

const app = express();
app.use(express.json());

app.get('/mcp/tools', async (req, res) => {
  console.log('[API] GET /mcp/tools');
  try {
    const authOk = await auth.verifyRequest(req);
    if (!authOk) {
      console.log('[API] Authentication failed for /mcp/tools');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const toolsList = Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    console.log('[API] Returning', toolsList.length, 'tools');
    res.json({ tools: toolsList });
  } catch (error) {
    console.error('[API ERROR] /mcp/tools:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/mcp/tools/:name', async (req, res) => {
  console.log('[API] POST /mcp/tools/:name, name:', req.params.name);
  try {
    const authOk = await auth.verifyRequest(req);
    if (!authOk) {
      console.log('[API] Authentication failed for /mcp/tools/:name');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { name } = req.params;
    const params = req.body;
    console.log('[API] Params:', params);
    
    const tool = tools[name];
    if (!tool) {
      console.log('[API] Tool not found:', name);
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    console.log('[API] Calling tool handler for:', name);
    const result = await tool.handler(params);
    console.log('[API] Tool result:', result);
    res.json({ result });
  } catch (error) {
    console.error('[API ERROR] /mcp/tools/:name:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  console.log('[HEALTH] Check');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, HOST, () => {
  console.log('=== MCP server running on http://' + HOST + ':' + PORT + ' ===');
});

console.log('=== Server initialization complete ===');