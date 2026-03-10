#!/usr/bin/env node

import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createServer } from '@prmichaelsen/youtube-mcp/factory';
import { JWTAuthProvider } from './auth/provider.js';
import { PlatformTokenResolver } from './auth/token-resolver.js';
import { env } from './config/environment.js';

// Validate required configuration
if (!env.PLATFORM_URL) {
  console.error('Error: PLATFORM_URL environment variable is required');
  process.exit(1);
}

if (!env.PLATFORM_SERVICE_TOKEN) {
  console.error('Error: PLATFORM_SERVICE_TOKEN environment variable is required');
  process.exit(1);
}

// Create auth provider (PLATFORM_SERVICE_TOKEN is the shared secret
// used by agentbase.me to sign JWTs and by this server to verify them)
const authProvider = new JWTAuthProvider({
  secret: env.PLATFORM_SERVICE_TOKEN,
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  cacheResults: true,
  cacheTtl: 60000,
});

// Create token resolver for per-user YouTube credentials
const tokenResolver = new PlatformTokenResolver({
  platformUrl: env.PLATFORM_URL,
  authProvider,
  cacheTtl: 5 * 60 * 1000, // 5 minutes
});

// Wrap server with authentication
const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    console.log(`Creating server instance for user: ${userId}`);
    const mcpServer = createServer(accessToken);
    return mcpServer.server;
  },
  authProvider,
  tokenResolver,
  resourceType: 'youtube',
  transport: {
    type: 'sse',
    port: parseInt(env.PORT),
    host: '0.0.0.0',
    basePath: '/mcp',
    cors: true,
    corsOrigin: env.CORS_ORIGIN,
  },
  middleware: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
    logging: {
      enabled: true,
      level: 'info',
    },
  },
});

// Start server
async function main() {
  try {
    await wrappedServer.start();
    console.log(`youtube-mcp server started successfully`);
    console.log(`Listening on port ${env.PORT}`);
    console.log(`Endpoint: http://0.0.0.0:${env.PORT}/mcp`);
    console.log(`Health check: http://0.0.0.0:${env.PORT}/mcp/health`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

main();
