# youtube-mcp

MCP server wrapping the YouTube Data API v3 for AI agents, mcp-auth enabled.

This MCP server uses [@prmichaelsen/mcp-auth](https://github.com/prmichaelsen/mcp-auth) for authentication and multi-tenancy.

> Built with [Agent Context Protocol](https://github.com/prmichaelsen/agent-context-protocol)

## Server Configuration

- **Type**: Dynamic (per-user credentials)
- **Auth Provider**: JWT
- **Platform**: https://agentbase.me

## Installation

```bash
npm install
```

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type check
npm run type-check
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `PLATFORM_URL`: Your platform URL
- `CORS_ORIGIN`: CORS origin (usually same as platform URL)
- `JWT_SECRET`: JWT secret for token validation

## Deployment

### Docker

```bash
# Build production image
docker build -f Dockerfile.production -t youtube-mcp .

# Run container
docker run -p 8080:8080 --env-file .env youtube-mcp
```

### Google Cloud Run

```bash
# Upload secrets
tsx scripts/upload-secrets.ts

# Deploy via Cloud Build
gcloud builds submit --config cloudbuild.yaml
```

## Architecture

See the following patterns for implementation details:

- [Server Wrapping](agent/patterns/mcp-auth-server-base.server-wrapping.md)
- [Auth Provider - JWT](agent/patterns/mcp-auth-server-base.auth-provider-jwt.md)
- [Token Resolver](agent/patterns/mcp-auth-server-base.token-resolver.md)
- [Environment Configuration](agent/patterns/mcp-auth-server-base.environment-configuration.md)

## ACP Development

This project uses the Agent Context Protocol for development:

- `@acp-init` - Initialize agent context
- `@acp-plan` - Plan milestones and tasks
- `@acp-proceed` - Continue with next task
- `@acp-status` - Check project status

See [AGENT.md](./AGENT.md) for complete ACP documentation.

## License

MIT

## Author

Patrick Michaelsen
