import type { AuthProvider, AuthResult, RequestContext } from '@prmichaelsen/mcp-auth';
import jwt from 'jsonwebtoken';

export interface JWTProviderConfig {
  secret: string;
  issuer: string;
  audience: string;
  cacheResults?: boolean;
  cacheTtl?: number;
  algorithm?: jwt.Algorithm;
}

interface CachedAuthResult {
  result: AuthResult;
  expiresAt: number;
}

export class JWTAuthProvider implements AuthProvider {
  private config: JWTProviderConfig;
  private authCache = new Map<string, CachedAuthResult>();
  private jwtTokenCache = new Map<string, string>();

  constructor(config: JWTProviderConfig) {
    this.config = {
      cacheResults: true,
      cacheTtl: 60000,
      algorithm: 'HS256',
      ...config,
    };
  }

  async initialize(): Promise<void> {
    console.log('JWT auth provider initialized');
    console.log(`  Issuer: ${this.config.issuer}`);
    console.log(`  Audience: ${this.config.audience}`);
    console.log(`  Caching: ${this.config.cacheResults ? 'enabled' : 'disabled'}`);
  }

  async authenticate(context: RequestContext): Promise<AuthResult> {
    try {
      const authHeader = context.headers?.['authorization'];

      if (!authHeader || Array.isArray(authHeader)) {
        return {
          authenticated: false,
          error: 'No authorization header provided',
        };
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return {
          authenticated: false,
          error: 'Invalid authorization format. Expected: Bearer <token>',
        };
      }

      const token = parts[1];

      // Check cache
      if (this.config.cacheResults) {
        const cached = this.authCache.get(token);
        if (cached && Date.now() < cached.expiresAt) {
          return cached.result;
        }
      }

      // Verify JWT
      const decoded = jwt.verify(token, this.config.secret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm!],
      }) as jwt.JwtPayload & {
        userId: string;
        email?: string;
        [key: string]: any;
      };

      if (!decoded.userId) {
        return {
          authenticated: false,
          error: 'JWT missing required userId claim',
        };
      }

      // Store JWT for forwarding to platform APIs
      this.jwtTokenCache.set(decoded.userId, token);

      const result: AuthResult = {
        authenticated: true,
        userId: decoded.userId,
        metadata: {
          email: decoded.email,
          ...Object.keys(decoded)
            .filter((key) => !['iss', 'aud', 'exp', 'iat', 'userId'].includes(key))
            .reduce((acc, key) => ({ ...acc, [key]: decoded[key] }), {}),
        },
      };

      // Cache result
      if (this.config.cacheResults) {
        this.authCache.set(token, {
          result,
          expiresAt: Date.now() + this.config.cacheTtl!,
        });
      }

      return result;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          authenticated: false,
          error: 'JWT token has expired',
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          authenticated: false,
          error: `JWT verification failed: ${error.message}`,
        };
      }

      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  getJWTToken(userId: string): string | undefined {
    return this.jwtTokenCache.get(userId);
  }

  async cleanup(): Promise<void> {
    this.authCache.clear();
    this.jwtTokenCache.clear();
    console.log('JWT auth provider cleaned up');
  }
}
