require('dotenv').config();
const express = require('express');
const { Server } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio');
const coolifyClient = require('./coolify');
const auth = require('./auth');

const PORT = process.env.MCP_SERVER_PORT || 3000;
const HOST = process.env.MCP_SERVER_HOST || '0.0.0.0';

const server = new Server(
  {
    name: 'coolify-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools = {
  list_projects: {
    name: 'list_projects',
    description: 'Liste tous les projets Coolify',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: async (args) => {
      await auth.verifyRequest();
      return await coolifyClient.listProjects();
    },
  },
  get_project: {
    name: 'get_project',
    description: 'Recupere les details dun projet Coolify',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
      },
      required: ['projectId'],
    },
    handler: async (args) => {
      await auth.verifyRequest();
      return await coolifyClient.getProject(args.projectId);
    },
  },
  list_services: {
    name: 'list_services',
    description: 'Liste tous les services dun projet',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
      },
      required: ['projectId'],
    },
    handler: async (args) => {
      await auth.verifyRequest();
      return await coolifyClient.listServices(args.projectId);
    },
  },
  deploy_service: {
    name: 'deploy_service',
    description: 'Deploie un service Coolify',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
        serviceId: { type: 'string', description: 'ID du service a deployer' },
        force: { type: 'boolean', description: 'Forcer le deploiement', default: false },
      },
      required: ['projectId', 'serviceId'],
    },
    handler: async (args) => {
      await auth.verifyRequest();
      return await coolifyClient.deployService(args.projectId, args.serviceId, args.force);
    },
  },
  get_service_logs: {
    name: 'get_service_logs',
    description: 'Recupere les logs dun service',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet Coolify' },
        serviceId: { type: 'string', description: 'ID du service' },
        lines: { type: 'number', description: 'Nombre de lignes de logs a recuperer', default: 100 },
      },
      required: ['projectId', 'serviceId'],
    },
    handler: async (args) => {
      await auth.verifyRequest();
      return await coolifyClient.getServiceLogs(args.projectId, args.serviceId, args.lines);
    },
  },
};

Object.entries(tools).forEach(([name, tool]) => {
  server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
});

async function startStdioServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Serveur MCP started in stdio mode');
}

async function startHttpServer() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/tools', async (req, res) => {
    try {
      const toolsList = await server.listTools();
      res.json(toolsList);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/tools/:name', async (req, res) => {
    try {
      await auth.verifyRequest(req);
      const { name } = req.params;
      const args = req.body;
      const result = await server.callTool(name, args);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.listen(PORT, HOST, () => {
    console.log('HTTP server started on port ' + PORT);
  });
}

(async () => {
  try {
    await startStdioServer();
    await startHttpServer();
    console.log('MCP and HTTP servers started successfully');
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
})();