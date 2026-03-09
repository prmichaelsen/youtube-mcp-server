import type { ResourceTokenResolver } from '@prmichaelsen/mcp-auth';
import type { JWTAuthProvider } from './provider.js';

export interface TokenResolverConfig {
  platformUrl: string;
  authProvider: JWTAuthProvider;
  cacheTokens?: boolean;
  cacheTtl?: number;
  customHeaders?: Record<string, string>;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

export class PlatformTokenResolver implements ResourceTokenResolver {
  private config: TokenResolverConfig;
  private tokenCache = new Map<string, CachedToken>();

  constructor(config: TokenResolverConfig) {
    this.config = {
      cacheTokens: true,
      cacheTtl: 300000, // 5 minutes
      ...config,
    };
  }

  async initialize(): Promise<void> {
    console.log('Platform token resolver initialized');
    console.log(`  Platform URL: ${this.config.platformUrl}`);
    console.log(`  Caching: ${this.config.cacheTokens ? 'enabled' : 'disabled'}`);
  }

  async resolveToken(userId: string, resourceType: string): Promise<string | null> {
    try {
      const cacheKey = `${userId}:${resourceType}`;

      // Check cache
      if (this.config.cacheTokens) {
        const cached = this.tokenCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
          return cached.token;
        }
      }

      // Get JWT for platform authentication
      const jwtToken = this.config.authProvider.getJWTToken(userId);
      if (!jwtToken) {
        console.warn(`No JWT token found for user ${userId}`);
        return null;
      }

      // Call platform credentials API
      const url = `${this.config.platformUrl}/api/credentials/${resourceType}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${jwtToken}`,
        'X-User-ID': userId,
        'Content-Type': 'application/json',
        ...this.config.customHeaders,
      };

      const response = await fetch(url, { headers });

      if (response.status === 404) {
        console.warn(`No ${resourceType} credentials configured for user ${userId}`);
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Platform API error: ${(errorData as any).error || response.statusText}`);
      }

      const data = (await response.json()) as { access_token?: string };
      const token = data.access_token;

      if (!token) {
        console.warn(`No access_token in response for ${userId}:${resourceType}`);
        return null;
      }

      // Cache token
      if (this.config.cacheTokens) {
        this.tokenCache.set(cacheKey, {
          token,
          expiresAt: Date.now() + this.config.cacheTtl!,
        });
      }

      return token;
    } catch (error) {
      console.error(`Failed to resolve token for ${userId}:${resourceType}:`, error);
      return null;
    }
  }

  clearCache(userId: string, resourceType: string): void {
    this.tokenCache.delete(`${userId}:${resourceType}`);
  }

  async cleanup(): Promise<void> {
    this.tokenCache.clear();
    console.log('Token resolver cleaned up');
  }
}
