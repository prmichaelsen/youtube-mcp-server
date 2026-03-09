# MCP Auth Server Architecture

**Concept**: Overall system architecture for MCP servers wrapped with @prmichaelsen/mcp-auth
**Created**: 2026-02-21
**Status**: Design Specification

---

## Overview

This document defines the architecture of MCP servers wrapped with [@prmichaelsen/mcp-auth](https://github.com/prmichaelsen/mcp-auth), covering system components, data flow, integration points, and design principles. It provides high-level guidance for building secure, scalable, multi-tenant MCP servers.

**Key Characteristics**:
- Stateless server design
- Per-user data isolation
- Factory pattern for server instances
- Pluggable authentication providers
- Horizontal scalability
- Cloud-native deployment

---

## Problem Statement

Building MCP servers with authentication and multi-tenancy requires:
- Secure authentication across multiple schemes (JWT, OAuth, API Key)
- Per-user data isolation
- Dynamic credential resolution for external services
- Scalable, stateless architecture
- Integration with cloud platforms
- Consistent patterns across implementations

Without a clear architecture, developers face:
- Inconsistent authentication implementations
- Security vulnerabilities
- Scalability issues
- Complex multi-tenancy logic
- Difficult maintenance

---

## Solution

The MCP auth server architecture provides:
- **Layered Architecture**: Clear separation of concerns
- **Factory Pattern**: Per-user server instances
- **Pluggable Auth**: Multiple authentication providers
- **Stateless Design**: Horizontal scaling support
- **Cloud Integration**: Native cloud platform support

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  (Browser, Desktop App, CLI)                                │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS + JWT/OAuth/API Key
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Transport Layer                           │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   SSE Transport  │         │  stdio Transport │         │
│  │  (HTTP/HTTPS)    │         │   (Local Only)   │         │
│  └──────────────────┘         └──────────────────┘         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Authentication Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Auth Provider (Pluggable)                │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │  │
│  │  │  JWT   │  │ OAuth  │  │API Key │  │  Env   │    │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │ userId extracted
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Server Factory Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  wrapServer() - Creates per-user server instances    │  │
│  │  • Injects userId into request context               │  │
│  │  • Calls serverFactory(userId) for each user         │  │
│  │  • Manages server instance lifecycle                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Per-User MCP Server Instance                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MCP Server (user-specific)                          │  │
│  │  • Tools registered for this user                    │  │
│  │  • Resources scoped to this user                     │  │
│  │  • Prompts available to this user                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tool Handlers                                        │  │
│  │  • Receive userId from context                       │  │
│  │  • Access user-specific data                         │  │
│  │  • Call external services with user credentials      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Access Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Database   │  │ External API │  │  File System │     │
│  │ (per-user)   │  │ (with creds) │  │  (per-user)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Transport Layer

**Purpose**: Handle client connections and protocol communication

**Components**:
- **SSE Transport**: HTTP-based Server-Sent Events for browser clients
- **stdio Transport**: Standard input/output for local CLI clients

**Responsibilities**:
- Accept incoming connections
- Parse MCP protocol messages
- Send responses to clients
- Handle connection lifecycle

**Key Patterns**:
- CORS configuration for SSE
- Health check endpoints
- Graceful shutdown

### 2. Authentication Layer

**Purpose**: Verify client identity and extract user information

**Components**:
- **Auth Provider Interface**: Pluggable authentication
- **JWT Provider**: Token-based authentication
- **OAuth Provider**: OAuth 2.0 flow
- **API Key Provider**: API key validation
- **Environment Provider**: Development-only auth

**Responsibilities**:
- Verify authentication credentials
- Extract userId from credentials
- Cache verification results
- Handle authentication errors

**Key Patterns**:
- Provider pattern for pluggability
- Caching for performance
- Security best practices

### 3. Server Factory Layer

**Purpose**: Create and manage per-user MCP server instances

**Components**:
- **wrapServer()**: Main wrapper function from mcp-auth
- **Server Factory**: User-provided function to create servers
- **Instance Manager**: Manages server lifecycle

**Responsibilities**:
- Create MCP server instance per user
- Inject userId into request context
- Route requests to correct server instance
- Clean up inactive instances

**Key Patterns**:
- Factory pattern
- Dependency injection
- Instance pooling (optional)

### 4. Token Resolver Layer (Optional)

**Purpose**: Fetch per-user credentials for external services

**Components**:
- **Token Resolver**: Fetches credentials from platform
- **Credential Cache**: Caches credentials with TTL
- **Platform API Client**: Communicates with platform

**Responsibilities**:
- Fetch user-specific credentials
- Cache credentials for performance
- Handle missing credentials gracefully
- Forward JWT for platform authentication

**Key Patterns**:
- Caching with TTL
- Graceful degradation
- Platform integration

### 5. Business Logic Layer

**Purpose**: Implement MCP tools, resources, and prompts

**Components**:
- **Tool Handlers**: Implement MCP tools
- **Resource Handlers**: Provide MCP resources
- **Prompt Handlers**: Define MCP prompts

**Responsibilities**:
- Implement business logic
- Access user-specific data
- Call external services
- Return MCP-compliant responses

**Key Patterns**:
- Service layer pattern
- Repository pattern
- Error handling

### 6. Data Access Layer

**Purpose**: Persist and retrieve data

**Components**:
- **Database**: User-scoped data storage
- **External APIs**: Third-party service integration
- **File System**: User-specific file storage

**Responsibilities**:
- Store user data
- Query user data
- Ensure data isolation
- Handle data access errors

**Key Patterns**:
- Repository pattern
- Data isolation by userId
- Connection pooling

---

## Request Flow

### Authentication Flow

```
1. Client Request
   │
   ├─→ Extract auth token from headers
   │
   ├─→ Auth Provider: verifyToken(token)
   │   │
   │   ├─→ Check cache
   │   │   └─→ Cache hit? Return cached result
   │   │
   │   ├─→ Verify token (JWT/OAuth/API Key)
   │   │   └─→ Validation fails? Throw AuthenticationError
   │   │
   │   └─→ Cache result and return { userId, ... }
   │
   └─→ Continue with userId in context
```

### Tool Execution Flow

```
1. Authenticated Request (userId known)
   │
   ├─→ Server Factory: getOrCreateServer(userId)
   │   │
   │   ├─→ Check if server exists for userId
   │   │   └─→ Exists? Return cached server
   │   │
   │   └─→ Create new server instance
   │       ├─→ serverFactory(userId)
   │       ├─→ Register tools
   │       └─→ Cache server instance
   │
   ├─→ Route request to user's server instance
   │
   ├─→ Tool Handler: execute(args, userId)
   │   │
   │   ├─→ Token Resolver (if needed)
   │   │   └─→ Fetch user credentials for external service
   │   │
   │   ├─→ Business Logic
   │   │   ├─→ Validate input
   │   │   ├─→ Access user data (filtered by userId)
   │   │   └─→ Call external services (with user creds)
   │   │
   │   └─→ Return MCP response
   │
   └─→ Send response to client
```

### Multi-Tenancy Isolation

```
User A Request                    User B Request
     │                                 │
     ├─→ Auth: userId = "userA"       ├─→ Auth: userId = "userB"
     │                                 │
     ├─→ Server Instance A             ├─→ Server Instance B
     │   (isolated)                    │   (isolated)
     │                                 │
     ├─→ Data Access                   ├─→ Data Access
     │   WHERE userId = "userA"        │   WHERE userId = "userB"
     │                                 │
     └─→ User A's data only            └─→ User B's data only
```

---

## Design Principles

### 1. Stateless Server Design

**Principle**: Servers should not maintain session state

**Implementation**:
- All state derived from authentication token
- No server-side sessions
- Horizontal scaling without sticky sessions
- Each request is independent

**Benefits**:
- Easy horizontal scaling
- No session management complexity
- Cloud Run auto-scaling friendly
- Simplified deployment

### 2. Per-User Isolation

**Principle**: Complete data isolation between users

**Implementation**:
- Separate server instances per user
- All data queries filtered by userId
- No shared mutable state
- Credentials scoped to user

**Benefits**:
- Security by design
- No data leakage
- Clear ownership
- Simplified access control

### 3. Factory Pattern

**Principle**: Create server instances dynamically

**Implementation**:
- `serverFactory(userId)` creates instances
- Instances cached per user
- Lazy instantiation
- Automatic cleanup

**Benefits**:
- Flexible server creation
- Resource efficiency
- Easy testing
- Clear lifecycle

### 4. Separation of Concerns

**Principle**: Each layer has single responsibility

**Implementation**:
- Transport handles connections
- Auth handles authentication
- Factory handles instance management
- Business logic handles tools
- Data access handles persistence

**Benefits**:
- Maintainable code
- Testable components
- Reusable patterns
- Clear boundaries

### 5. Pluggable Authentication

**Principle**: Support multiple auth schemes

**Implementation**:
- Auth provider interface
- Multiple implementations (JWT, OAuth, API Key)
- Runtime selection
- Easy to extend

**Benefits**:
- Flexibility
- Platform independence
- Easy migration
- Testing support

### 6. Fail-Safe Defaults

**Principle**: Secure and safe by default

**Implementation**:
- Authentication required by default
- CORS restricted by default
- Secrets in Secret Manager
- Minimal permissions

**Benefits**:
- Security by default
- Fewer configuration errors
- Production-ready
- Compliance-friendly

---

## Scalability Considerations

### Horizontal Scaling

**Strategy**: Scale by adding more instances

**Implementation**:
- Stateless server design
- Cloud Run auto-scaling
- No sticky sessions required
- Shared database/cache

**Scaling Factors**:
- Request rate
- CPU utilization
- Memory usage
- Response latency

**Configuration**:
```yaml
# Cloud Run scaling
min-instances: 0  # Scale to zero
max-instances: 100  # Scale up to 100
concurrency: 80  # Requests per instance
```

### Caching Strategies

**1. Token Verification Cache**
- Cache verified tokens (5-10 minutes)
- Reduce auth provider calls
- In-memory cache per instance

**2. Credential Cache**
- Cache user credentials (5 minutes)
- Reduce platform API calls
- TTL-based expiration

**3. Data Cache** (Optional)
- Cache frequently accessed data
- Redis or Memcached
- Invalidation strategy required

### Performance Optimization

**1. Connection Pooling**
- Database connection pool
- HTTP client connection reuse
- Reduce connection overhead

**2. Lazy Loading**
- Create server instances on demand
- Load credentials when needed
- Defer expensive operations

**3. Parallel Processing**
- Concurrent credential fetching
- Parallel database queries
- Async/await patterns

**4. Resource Limits**
- Memory limits per instance
- CPU allocation
- Timeout configuration

### Load Distribution

```
                    Load Balancer
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   Instance 1       Instance 2       Instance 3
   (us-central1)    (us-central1)    (us-central1)
        │                │                │
        └────────────────┼────────────────┘
                         │
                    Shared Database
```

---

## Integration Points

### 1. Platform Integration

**Purpose**: Integrate with multi-tenant platform

**Integration**:
- JWT issued by platform
- Credential API for user tokens
- Service token for authentication
- Webhook callbacks (optional)

**API Endpoints**:
- `GET /api/credentials/{userId}/{provider}` - Fetch credentials
- `POST /api/webhooks/credential-updated` - Credential updates

### 2. External Services

**Purpose**: Access third-party APIs with user credentials

**Integration**:
- OAuth tokens from platform
- API keys from platform
- Dynamic credential resolution
- Token refresh handling

**Examples**:
- GitHub API with user's GitHub token
- Firebase with user's service account
- Slack with user's workspace token

### 3. Database

**Purpose**: Persist user data

**Integration**:
- PostgreSQL, MySQL, MongoDB, etc.
- Connection pooling
- User-scoped queries
- Migration management

**Schema Pattern**:
```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,  -- Always include userId
  title VARCHAR(255),
  content TEXT,
  created_at TIMESTAMP,
  INDEX idx_user_id (user_id)  -- Index for performance
);
```

### 4. Monitoring & Logging

**Purpose**: Observe system behavior

**Integration**:
- Cloud Logging for logs
- Cloud Monitoring for metrics
- Error Reporting for errors
- Cloud Trace for tracing

**Metrics**:
- Request rate
- Error rate
- Latency (p50, p95, p99)
- Active users

---

## Deployment Architecture

### Cloud Run Deployment

```
┌─────────────────────────────────────────────────────────┐
│                    Cloud Load Balancer                   │
│                  (HTTPS, Custom Domain)                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Cloud Run Service                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Container Instances (Auto-scaled 0-100)         │  │
│  │  • Docker image from Container Registry          │  │
│  │  • Environment variables                         │  │
│  │  • Secrets from Secret Manager                   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │Database│  │ Secret │  │Platform│
   │        │  │Manager │  │  API   │
   └────────┘  └────────┘  └────────┘
```

### Multi-Region Deployment (Optional)

```
                    Global Load Balancer
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   us-central1         europe-west1        asia-east1
   Cloud Run           Cloud Run           Cloud Run
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    Global Database
                  (Multi-region replication)
```

---

## Security Architecture

### Defense in Depth

```
Layer 1: Network Security
  • HTTPS only
  • CORS restrictions
  • Rate limiting

Layer 2: Authentication
  • JWT/OAuth/API Key verification
  • Token expiration
  • Signature validation

Layer 3: Authorization
  • Per-user server instances
  • userId-scoped queries
  • Credential isolation

Layer 4: Data Security
  • Encryption at rest
  • Encryption in transit
  • Secret Manager for secrets

Layer 5: Monitoring
  • Audit logging
  • Error tracking
  • Anomaly detection
```

---

## Benefits

1. **Security**: Multi-layered security with authentication and isolation
2. **Scalability**: Horizontal scaling with stateless design
3. **Flexibility**: Pluggable auth providers and patterns
4. **Maintainability**: Clear separation of concerns
5. **Testability**: Each layer independently testable
6. **Cloud-Native**: Optimized for cloud platforms
7. **Multi-Tenancy**: Built-in per-user isolation
8. **Performance**: Caching and optimization strategies

---

## Trade-offs

1. **Complexity**: More layers than simple server
2. **Memory**: Per-user instances consume memory
3. **Latency**: Auth verification adds latency (mitigated by caching)
4. **Learning Curve**: Requires understanding of architecture
5. **Dependencies**: Depends on mcp-auth library

---

## Implementation Checklist

- [ ] Choose authentication provider (JWT, OAuth, API Key)
- [ ] Implement server factory function
- [ ] Configure transport (SSE or stdio)
- [ ] Implement token resolver (if dynamic credentials needed)
- [ ] Set up database with userId columns
- [ ] Configure CORS for SSE transport
- [ ] Implement health check endpoint
- [ ] Set up logging and monitoring
- [ ] Configure secrets in Secret Manager
- [ ] Deploy to Cloud Run
- [ ] Test multi-user isolation
- [ ] Load test and optimize

---

## Related Documents

- [Server Wrapping Pattern](../patterns/mcp-auth-server-base.server-wrapping.md)
- [Auth Provider Patterns](../patterns/mcp-auth-server-base.auth-provider-jwt.md)
- [Token Resolver Pattern](../patterns/mcp-auth-server-base.token-resolver.md)
- [Security Design](security-considerations.md)

---

**Status**: Design Specification
**Recommendation**: Follow this architecture for all MCP auth-wrapped servers
