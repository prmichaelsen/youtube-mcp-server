# Security Considerations for MCP Auth Servers

**Concept**: Security best practices and considerations for MCP servers wrapped with @prmichaelsen/mcp-auth
**Created**: 2026-02-21
**Status**: Design Specification

---

## Overview

This document defines security considerations, best practices, and requirements for MCP servers wrapped with [@prmichaelsen/mcp-auth](https://github.com/prmichaelsen/mcp-auth). It covers authentication security, secret management, multi-tenancy isolation, CORS configuration, input validation, and transport security.

**Security Principles**:
- Defense in depth
- Least privilege
- Secure by default
- Zero trust architecture
- Fail securely

---

## Problem Statement

MCP servers handling multi-tenant data face significant security challenges:
- **Authentication**: Verifying user identity securely
- **Authorization**: Ensuring users only access their data
- **Secrets**: Managing sensitive credentials safely
- **Data Isolation**: Preventing cross-user data leakage
- **Transport Security**: Protecting data in transit
- **Input Validation**: Preventing injection attacks
- **CORS**: Restricting cross-origin access

Without proper security measures, servers are vulnerable to:
- Unauthorized access
- Data breaches
- Credential theft
- Cross-user data leakage
- Injection attacks
- Man-in-the-middle attacks

---

## Solution

Implement comprehensive security measures across all layers:
- **Authentication Layer**: Secure token verification
- **Authorization Layer**: Per-user data isolation
- **Secret Management**: Cloud Secret Manager
- **Transport Layer**: HTTPS only
- **Input Validation**: Sanitize all inputs
- **CORS**: Restrict origins
- **Monitoring**: Audit logging and alerting

---

## Authentication Security

### JWT Validation

**Requirements**:
1. **Verify Signature**: Always verify JWT signature
2. **Check Expiration**: Reject expired tokens
3. **Validate Issuer**: Verify token issuer
4. **Validate Audience**: Check token audience
5. **Use Strong Secrets**: Minimum 256-bit secrets

**Implementation**:
```typescript
import jwt from 'jsonwebtoken';

export async function verifyJWT(token: string): Promise<TokenPayload> {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
      algorithms: ['HS256', 'RS256'],  // Specify allowed algorithms
      clockTolerance: 0  // No clock skew tolerance
    }) as TokenPayload;

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    throw new AuthenticationError('Token verification failed');
  }
}
```

**Security Checklist**:
- ✅ Signature verification enabled
- ✅ Expiration checked
- ✅ Issuer validated
- ✅ Audience validated
- ✅ Algorithm whitelist specified
- ✅ No clock skew tolerance
- ✅ Errors don't leak information

### Token Expiration

**Best Practices**:
- **Access Tokens**: Short-lived (15-60 minutes)
- **Refresh Tokens**: Longer-lived (7-30 days)
- **Service Tokens**: Rotate regularly (90 days)

**Implementation**:
```typescript
// Generate short-lived access token
const accessToken = jwt.sign(
  { userId, email },
  secret,
  {
    expiresIn: '1h',  // 1 hour
    issuer: 'platform',
    audience: 'mcp-server'
  }
);

// Generate refresh token
const refreshToken = jwt.sign(
  { userId, type: 'refresh' },
  refreshSecret,
  {
    expiresIn: '7d',  // 7 days
    issuer: 'platform',
    audience: 'mcp-server'
  }
);
```

### Token Storage

**Client-Side**:
- ❌ **Never** store in localStorage (XSS vulnerable)
- ❌ **Never** store in sessionStorage (XSS vulnerable)
- ✅ **Use** httpOnly cookies (XSS protected)
- ✅ **Use** secure cookies (HTTPS only)
- ✅ **Use** SameSite cookies (CSRF protected)

**Server-Side**:
- ✅ **Never** log tokens
- ✅ **Never** store tokens in database
- ✅ **Cache** verification results only
- ✅ **Use** short TTL for cache (5-10 minutes)

### Authentication Caching

**Security Considerations**:
```typescript
interface CachedAuth {
  userId: string;
  expiresAt: number;  // When cache expires
  tokenExpiry: number;  // When token expires
}

const authCache = new Map<string, CachedAuth>();

export async function verifyWithCache(token: string): Promise<TokenPayload> {
  const cached = authCache.get(token);
  
  if (cached) {
    // Check if cache is still valid
    if (Date.now() < cached.expiresAt && Date.now() < cached.tokenExpiry) {
      return { userId: cached.userId };
    }
    // Cache expired, remove it
    authCache.delete(token);
  }

  // Verify token
  const payload = await verifyJWT(token);
  
  // Cache result (5 minute TTL, but not beyond token expiry)
  const cacheExpiry = Date.now() + (5 * 60 * 1000);
  const tokenExpiry = payload.exp * 1000;
  
  authCache.set(token, {
    userId: payload.userId,
    expiresAt: Math.min(cacheExpiry, tokenExpiry),
    tokenExpiry
  });

  return payload;
}
```

**Cache Security**:
- ✅ Cache TTL shorter than token expiry
- ✅ Clear cache on token expiry
- ✅ Don't cache failed verifications
- ✅ Limit cache size to prevent memory exhaustion

---

## Secret Management

### Never Store Secrets in Code

**❌ NEVER DO THIS**:
```typescript
// WRONG - Hardcoded secret
const JWT_SECRET = 'my-secret-key-123';

// WRONG - Committed .env file
// .env (in git)
JWT_SECRET=my-secret-key
```

**✅ CORRECT APPROACH**:
```typescript
// Use environment variables
const JWT_SECRET = process.env.JWT_SECRET!;

// .env (gitignored)
JWT_SECRET=...

// .env.example (committed)
JWT_SECRET=your-jwt-secret-here
```

### Google Cloud Secret Manager

**Setup**:
```bash
# Create secret
echo -n "my-secret-value" | gcloud secrets create my-mcp-server-jwt-secret \
  --data-file=- \
  --replication-policy=automatic

# Grant access to service account
gcloud secrets add-iam-policy-binding my-mcp-server-jwt-secret \
  --member="serviceAccount:my-mcp-server@project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Use in Cloud Run
gcloud run deploy my-mcp-server \
  --update-secrets=JWT_SECRET=my-mcp-server-jwt-secret:latest
```

**Access in Code**:
```typescript
// Secrets automatically available as environment variables in Cloud Run
const jwtSecret = process.env.JWT_SECRET!;

// Or fetch programmatically
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

async function getSecret(secretName: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${secretName}/versions/latest`
  });
  return version.payload?.data?.toString() || '';
}
```

### Secret Rotation

**Strategy**:
1. Generate new secret
2. Add as new version in Secret Manager
3. Deploy with new version
4. Verify new version works
5. Disable old version after grace period

**Implementation**:
```bash
# Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# Add new version
echo -n "${NEW_SECRET}" | gcloud secrets versions add my-mcp-server-jwt-secret \
  --data-file=-

# Deploy with latest version (automatic)
gcloud run deploy my-mcp-server \
  --image=gcr.io/project/my-mcp-server:latest

# After verification, disable old version
gcloud secrets versions disable 1 --secret=my-mcp-server-jwt-secret
```

**Rotation Schedule**:
- **JWT Secrets**: Every 90 days
- **API Keys**: Every 90 days
- **Service Tokens**: Every 90 days
- **Database Passwords**: Every 90 days

### Environment Variable Security

**Best Practices**:
- ✅ Use `.env` files (gitignored)
- ✅ Provide `.env.example` (committed)
- ✅ Never log environment variables
- ✅ Validate required variables on startup
- ❌ Never commit `.env` files
- ❌ Never use `.env.production` (use Secret Manager)

**Validation**:
```typescript
// Validate on startup
function validateEnvironment(): void {
  const required = [
    'JWT_SECRET',
    'PLATFORM_SERVICE_TOKEN',
    'DATABASE_URL'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  // Validate secret strength
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}
```

---

## Multi-Tenancy Security

### User Data Isolation

**Principle**: Users must NEVER access other users' data

**Implementation**:
```typescript
// ALWAYS filter by userId
export class NoteService {
  async getNotes(userId: string): Promise<Note[]> {
    // ✅ CORRECT - Filtered by userId
    return await db.notes.find({ userId });
  }

  async getNote(userId: string, noteId: string): Promise<Note | null> {
    // ✅ CORRECT - Both userId and noteId
    return await db.notes.findOne({ id: noteId, userId });
  }

  async deleteNote(userId: string, noteId: string): Promise<void> {
    // ✅ CORRECT - Verify ownership before delete
    const note = await db.notes.findOne({ id: noteId, userId });
    if (!note) {
      throw new NotFoundError('Note');
    }
    await db.notes.delete({ id: noteId, userId });
  }
}
```

**❌ SECURITY VULNERABILITY**:
```typescript
// WRONG - No userId filter
async getNote(noteId: string): Promise<Note | null> {
  return await db.notes.findOne({ id: noteId });  // ❌ Any user can access any note!
}
```

### Database Schema

**Always include userId column**:
```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,  -- ✅ REQUIRED
  title VARCHAR(255),
  content TEXT,
  created_at TIMESTAMP,
  
  -- Index for performance
  INDEX idx_user_id (user_id),
  INDEX idx_user_notes (user_id, created_at)
);

-- Row-level security (PostgreSQL)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON notes
  FOR ALL
  USING (user_id = current_setting('app.current_user_id'));
```

### Per-User Server Instances

**Security Benefit**: Complete isolation between users

```typescript
// Server factory creates isolated instances
export function serverFactory(userId: string): Server {
  const server = new Server({
    name: `mcp-server-${userId}`,
    version: '1.0.0'
  });

  // Register tools with userId context
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // This server instance only sees this user's data
    const tools = await getToolsForUser(userId);
    return { tools };
  });

  return server;
}
```

### Preventing Cross-User Access

**Checklist**:
- ✅ All database queries filtered by userId
- ✅ All file operations scoped to user directory
- ✅ All external API calls use user's credentials
- ✅ No shared mutable state between users
- ✅ Server instances isolated per user
- ✅ Credentials never shared between users

---

## CORS Security

### Origin Validation

**Production Configuration**:
```typescript
// ✅ CORRECT - Specific origins
const corsOptions: cors.CorsOptions = {
  origin: 'https://platform.example.com',  // Single origin
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

**❌ INSECURE**:
```typescript
// WRONG - Wildcard origin with credentials
const corsOptions: cors.CorsOptions = {
  origin: '*',  // ❌ NEVER use with credentials
  credentials: true  // ❌ Can't use credentials with '*'
};

// WRONG - Allow all origins
const corsOptions: cors.CorsOptions = {
  origin: true,  // ❌ Accepts any origin
  credentials: true
};
```

### Multiple Origins

**Whitelist Approach**:
```typescript
const allowedOrigins = [
  'https://platform.example.com',
  'https://admin.example.com'
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
```

### CORS Security Checklist

- ✅ Specific origins in production
- ✅ Credentials enabled only when needed
- ✅ Whitelist allowed methods
- ✅ Whitelist allowed headers
- ✅ Set appropriate maxAge
- ❌ Never use wildcard (*) with credentials
- ❌ Never allow all origins in production

---

## Input Validation

### Validate All Inputs

**Principle**: Never trust user input

**Implementation**:
```typescript
import { z } from 'zod';

// Define schema
const CreateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(10000),
  tags: z.array(z.string().max(50)).max(10).optional()
});

// Validate input
export async function handleCreateNote(args: unknown, userId: string) {
  // Validate
  const parsed = CreateNoteSchema.safeParse(args);
  if (!parsed.success) {
    throw new ValidationError('Invalid input', {
      errors: parsed.error.errors
    });
  }

  const { title, content, tags } = parsed.data;

  // Sanitize (if needed)
  const sanitizedTitle = sanitizeHtml(title);
  const sanitizedContent = sanitizeHtml(content);

  // Create note
  return await noteService.createNote(userId, sanitizedTitle, sanitizedContent, tags);
}
```

### SQL Injection Prevention

**✅ CORRECT - Parameterized Queries**:
```typescript
// Use parameterized queries
const notes = await db.query(
  'SELECT * FROM notes WHERE user_id = $1 AND title LIKE $2',
  [userId, `%${searchTerm}%`]
);
```

**❌ VULNERABLE - String Concatenation**:
```typescript
// WRONG - SQL injection vulnerability
const notes = await db.query(
  `SELECT * FROM notes WHERE user_id = '${userId}' AND title LIKE '%${searchTerm}%'`
);
```

### XSS Prevention

**Sanitize HTML**:
```typescript
import sanitizeHtml from 'sanitize-html';

// Sanitize user-provided HTML
const clean = sanitizeHtml(userInput, {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p'],
  allowedAttributes: {
    'a': ['href']
  },
  allowedSchemes: ['http', 'https']
});
```

### Path Traversal Prevention

**Validate File Paths**:
```typescript
import path from 'path';

export function getUserFilePath(userId: string, filename: string): string {
  // Validate filename
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new ValidationError('Invalid filename');
  }

  // Construct safe path
  const userDir = path.join('/data/users', userId);
  const filePath = path.join(userDir, filename);

  // Verify path is within user directory
  if (!filePath.startsWith(userDir)) {
    throw new ValidationError('Invalid file path');
  }

  return filePath;
}
```

---

## HTTPS Requirements

### Production Requirements

**Mandatory**:
- ✅ HTTPS only in production
- ✅ TLS 1.2 or higher
- ✅ Valid SSL certificate
- ✅ HSTS enabled
- ❌ No HTTP in production

### Cloud Run Configuration

**Automatic HTTPS**:
- Cloud Run provides HTTPS automatically
- Custom domains require DNS configuration
- Certificates managed by Google

**HSTS Header**:
```typescript
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
```

### Certificate Management

**Cloud Run**:
- Automatic certificate provisioning
- Automatic renewal
- No manual management needed

**Custom Domains**:
```bash
# Map custom domain
gcloud run domain-mappings create \
  --service=my-mcp-server \
  --domain=mcp.example.com \
  --region=us-central1

# Certificate automatically provisioned
```

---

## Additional Security Measures

### Rate Limiting

**Prevent Abuse**:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/mcp', limiter);
```

### Security Headers

**Helmet.js**:
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

### Audit Logging

**Log Security Events**:
```typescript
// Log authentication events
logger.info('Authentication successful', {
  userId,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});

// Log authorization failures
logger.warn('Authorization failed', {
  userId,
  resource: 'note',
  resourceId: noteId,
  action: 'delete',
  ip: req.ip
});

// Log suspicious activity
logger.error('Suspicious activity detected', {
  userId,
  activity: 'multiple_failed_auth',
  count: failedAttempts,
  ip: req.ip
});
```

### Monitoring and Alerting

**Set Up Alerts**:
- High error rate
- Multiple failed authentications
- Unusual access patterns
- Resource exhaustion
- Slow response times

---

## Security Checklist

### Authentication
- [ ] JWT signature verification enabled
- [ ] Token expiration checked
- [ ] Issuer and audience validated
- [ ] Strong secrets (256-bit minimum)
- [ ] Tokens never logged
- [ ] Caching with appropriate TTL

### Secret Management
- [ ] No secrets in code
- [ ] No secrets in version control
- [ ] Secrets in Secret Manager
- [ ] .env files gitignored
- [ ] Secret rotation schedule defined
- [ ] Secrets validated on startup

### Multi-Tenancy
- [ ] All queries filtered by userId
- [ ] Per-user server instances
- [ ] No shared mutable state
- [ ] Database schema includes userId
- [ ] Row-level security enabled (if supported)

### CORS
- [ ] Specific origins in production
- [ ] No wildcard with credentials
- [ ] Credentials enabled only when needed
- [ ] Allowed methods whitelisted
- [ ] Allowed headers whitelisted

### Input Validation
- [ ] All inputs validated
- [ ] Schema validation (Zod/Joi)
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize HTML)
- [ ] Path traversal prevention

### Transport Security
- [ ] HTTPS only in production
- [ ] TLS 1.2 or higher
- [ ] Valid SSL certificate
- [ ] HSTS enabled
- [ ] Security headers configured

### Additional Measures
- [ ] Rate limiting enabled
- [ ] Helmet.js configured
- [ ] Audit logging implemented
- [ ] Monitoring and alerting set up
- [ ] Regular security audits scheduled

---

## Related Documents

- [Auth Provider Patterns](../patterns/mcp-auth-server-base.auth-provider-jwt.md)
- [Secrets Management Pattern](../patterns/mcp-auth-server-base.secrets-management.md)
- [CORS Configuration Pattern](../patterns/mcp-auth-server-base.cors-configuration.md)
- [Architecture Design](mcp-auth-server-base.architecture.md)

---

**Status**: Design Specification
**Recommendation**: Follow all security best practices for production deployments
