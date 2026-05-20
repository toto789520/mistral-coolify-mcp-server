const axios = require('axios');

const COOLIFY_URL = process.env.COOLIFY_URL;
const COOLIFY_API_TOKEN = process.env.COOLIFY_API_TOKEN;

if (!COOLIFY_URL || !COOLIFY_API_TOKEN) {
  throw new Error('COOLIFY_URL and COOLIFY_API_TOKEN must be set in environment variables');
}

const client = axios.create({
  baseURL: COOLIFY_URL,
  headers: {
    'Authorization': `Bearer ${COOLIFY_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function listProjects() {
  try {
    const response = await client.get('/api/v1/projects');
    return {
      success: true,
      projects: response.data || [],
    };
  } catch (error) {
    console.error('Error listing projects:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getProject(projectId) {
  try {
    const response = await client.get(`/api/v1/projects/${projectId}`);
    return {
      success: true,
      project: response.data,
    };
  } catch (error) {
    console.error(`Error getting project ${projectId}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function listServices(projectId) {
  try {
    const response = await client.get(`/api/v1/projects/${projectId}/services`);
    return {
      success: true,
      services: response.data || [],
    };
  } catch (error) {
    console.error(`Error listing services for project ${projectId}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function deployService(projectId, serviceId, force = false) {
  try {
    const response = await client.post(`/api/v1/projects/${projectId}/services/${serviceId}/deploy`, {
      force,
    });
    return {
      success: true,
      deployment: response.data,
    };
  } catch (error) {
    console.error(`Error deploying service ${serviceId}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getServiceLogs(projectId, serviceId, lines = 100) {
  try {
    const response = await client.get(`/api/v1/projects/${projectId}/services/${serviceId}/logs`, {
      params: { lines },
    });
    return {
      success: true,
      logs: response.data,
    };
  } catch (error) {
    console.error(`Error getting logs for service ${serviceId}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  listProjects,
  getProject,
  listServices,
  deployService,
  getServiceLogs,
};