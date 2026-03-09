#!/usr/bin/env node

import { wrapServer } from '@prmichaelsen/mcp-auth';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
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

// Server factory: creates a new MCP server instance per user
async function createServer(accessToken: string, userId: string): Promise<Server> {
  const server = new Server(
    {
      name: 'youtube-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // TODO: Add YouTube Data API v3 tools here
  // Each tool will use the accessToken to make authenticated YouTube API calls

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'youtube_search',
          description: 'Search for YouTube videos',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results (1-50)',
              },
            },
            required: ['query'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    if (name === 'youtube_search') {
      const query = args.query as string;
      const maxResults = (args.maxResults as number) || 5;

      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('q', query);
      url.searchParams.set('maxResults', String(maxResults));
      url.searchParams.set('type', 'video');

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`YouTube API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

// Wrap server with authentication
const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    return await createServer(accessToken, userId);
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
