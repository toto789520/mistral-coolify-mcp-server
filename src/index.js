import 'dotenv/config';
import express from 'express';
import coolifyClient from './coolify.js';
import auth from './auth.js';

const PORT = process.env.MCP_SERVER_PORT || 3000;
const HOST = process.env.MCP_SERVER_HOST || '0.0.0.0';

console.log('=== MCP Server Starting ===');
console.log('COOLIFY_URL:', process.env.COOLIFY_URL);
console.log('COOLIFY_API_TOKEN:', process.env.COOLIFY_API_TOKEN ? '***' : 'NOT SET');
console.log('MCP_SERVER_PORT:', PORT);
console.log('MCP_SERVER_HOST:', HOST);
console.log('AUTH_SECRET:', process.env.AUTH_SECRET ? '***' : 'NOT SET');
console.log('==========================');

const tools = {
  list_projects: {
    name: 'list_projects',
    description: 'Liste tous les projets Coolify',
    parameters: { type: 'object', properties: {} },
    handler: async (params) => {
      console.log('Calling list_projects...');
      await auth.verifyRequest();
      const result = await coolifyClient.listProjects();
      console.log('list_projects result:', JSON.stringify(result));
      return result;
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
      console.log('Calling get_project with projectId:', params.projectId);
      await auth.verifyRequest();
      const result = await coolifyClient.getProject(params.projectId);
      console.log('get_project result:', JSON.stringify(result));
      return result;
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
      console.log('Calling list_services with projectId:', params.projectId);
      await auth.verifyRequest();
      const result = await coolifyClient.listServices(params.projectId);
      console.log('list_services result:', JSON.stringify(result));
      return result;
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
      console.log('Calling deploy_service with:', { projectId: params.projectId, serviceId: params.serviceId, force: params.force });
      await auth.verifyRequest();
      const result = await coolifyClient.deployService(params.projectId, params.serviceId, params.force);
      console.log('deploy_service result:', JSON.stringify(result));
      return result;
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
      console.log('Calling get_service_logs with:', { projectId: params.projectId, serviceId: params.serviceId, lines: params.lines });
      await auth.verifyRequest();
      const result = await coolifyClient.getServiceLogs(params.projectId, params.serviceId, params.lines);
      console.log('get_service_logs result:', JSON.stringify(result));
      return result;
    },
  },
};

const app = express();
app.use(express.json());

app.get('/mcp/tools', async (req, res) => {
  try {
    console.log('GET /mcp/tools called');
    await auth.verifyRequest(req);
    const toolsList = Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    console.log('Returning tools list:', toolsList.length, 'tools');
    res.json({ tools: toolsList });
  } catch (error) {
    console.error('Error in /mcp/tools:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/mcp/tools/:name', async (req, res) => {
  try {
    console.log('POST /mcp/tools/:name called with name:', req.params.name);
    await auth.verifyRequest(req);
    const { name } = req.params;
    const params = req.body;
    const tool = tools[name];
    if (!tool) {
      console.log('Tool not found:', name);
      return res.status(404).json({ error: 'Tool not found' });
    }
    console.log('Calling tool handler...');
    const result = await tool.handler(params);
    console.log('Tool result:', JSON.stringify(result));
    res.json({ result });
  } catch (error) {
    console.error('Error in /mcp/tools/:name:', error.message);
    console.error('Stack:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  console.log('GET /health called');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    envCheck: {
      hasCoolifyUrl: !!process.env.COOLIFY_URL,
      hasCoolifyToken: !!process.env.COOLIFY_API_TOKEN,
      hasAuthSecret: !!process.env.AUTH_SECRET
    }
  });
});

app.listen(PORT, HOST, () => {
  console.log(`MCP server running on http://${HOST}:${PORT}`);
  console.log('Available tools:', Object.keys(tools).join(', '));
});

console.log('Server initialization complete. Listening on port', PORT);