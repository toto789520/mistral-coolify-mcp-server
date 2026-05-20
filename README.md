# Mistral Coolify MCP Server

Un serveur MCP (Model Context Protocol) pour connecter Mistral a Coolify, permettant d'interagir avec vos projets et services Coolify directement via Mistral.

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

Configurez ces variables d'environnement dans Coolify (ne pas utiliser de fichier .env) :

COOLIFY_URL=https://votre-instance-coolify.com
COOLIFY_API_TOKEN=votre_token_api_coolify
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=0.0.0.0
AUTH_SECRET=votre_secret (optionnel)

### Generer un AUTH_SECRET securise

Sur Linux/macOS :
openssl rand -hex 32

Avec Node.js :
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

## Deployement sur Coolify

1. Creez un projet dans Coolify
2. Ajoutez un service Custom Application avec Dockerfile
3. Depot : https://github.com/toto789520/mistral-coolify-mcp-server
4. Dans Configuration > Environment Variables, ajoutez toutes les variables ci-dessus
5. Deployez

## Outils disponibles

- list_projects
- get_project(projectId)
- list_services(projectId)
- deploy_service(projectId, serviceId, force)
- get_service_logs(projectId, serviceId, lines)

## Securite

- Gardez votre token API secret
- Utilisez les variables d'environnement de Coolify (pas de fichier .env)
- AUTH_SECRET doit etre complexe et aleatoire

## Licence

MIT