# Mistral Coolify MCP Server

Un serveur MCP (Model Context Protocol) pour connecter Mistral a Coolify.

## Fonctionnalites
- Lister tous les projets Coolify
- Recuperer les details d'un projet
- Lister les services d'un projet
- Deployer un service
- Recuperer les logs d'un service

## Prerequis
- Node.js >= 18.0.0
- Docker
- Token API Coolify

## Configuration
Creez un fichier .env :

COOLIFY_URL=https://votre-instance-coolify.com
COOLIFY_API_TOKEN=votre_token
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=0.0.0.0
AUTH_SECRET=optionnel

## Deployement sur Coolify
1. Creez un projet dans Coolify
2. Ajoutez un service Custom Application avec Dockerfile
3. Depot : https://github.com/toto789520/mistral-coolify-mcp-server
4. Ajoutez les variables d'environnement
5. Deployez

## Outils
- list_projects
- get_project(projectId)
- list_services(projectId)
- deploy_service(projectId, serviceId, force)
- get_service_logs(projectId, serviceId, lines)

## Licence
MIT