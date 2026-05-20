import 'dotenv/config';
import express from 'express';
import coolifyClient from './coolify.js';
import auth from './auth.js';

const PORT = process.env.MCP_SERVER_PORT || 3000;
const HOST = process.env.MCP_SERVER_HOST || '0.0.0.0';

// Implémentation manuelle MCP - pas besoin de SDK
const tools = {
  list_projects: {
    name: 'list_projects',
    description: 'Liste tous les projets Coolify',
    parameters: { type: 'object', properties: {} },
    handler: async (params) => {
      await auth.verifyRequest();
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
      await auth.verifyRequest();
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
      await auth.verifyRequest();
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
      await auth.verifyRequest();
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
      await auth.verifyRequest();
      return await coolifyClient.getServiceLogs(params.projectId, params.serviceId, params.lines);
    },
  },
};

// Serveur HTTP pour MCP
const app = express();
app.use(express.json());

app.get('/mcp/tools', async (req, res) => {
  try {
    await auth.verifyRequest(req);
    const toolsList = Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    res.json({ tools: toolsList });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/mcp/tools/:name', async (req, res) => {
  try {
    await auth.verifyRequest(req);
    const { name } = req.params;
    const params = req.body;
    const tool = tools[name];
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    const result = await tool.handler(params);
    res.json({ result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, HOST, () => {
  console.log(`MCP server running on http://${HOST}:${PORT}`);
});