export const env = {
  PORT: process.env.PORT || '8080',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PLATFORM_URL: process.env.PLATFORM_URL || '',
  PLATFORM_SERVICE_TOKEN: process.env.PLATFORM_SERVICE_TOKEN || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_ISSUER: process.env.JWT_ISSUER || 'agentbase.me',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'mcp-server',
};
