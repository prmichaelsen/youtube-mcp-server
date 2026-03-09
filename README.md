# youtube-mcp-server

MCP server wrapping the YouTube Data API v3 for AI agents, mcp-auth enabled.

> Built with [Agent Context Protocol](https://github.com/prmichaelsen/agent-context-protocol)

## Quick Start

[Add installation and usage instructions here]

## Features

- Full YouTube Data API v3 coverage (52 endpoints)
- OAuth 2.0 authentication with mcp-auth integration
- stdio and streamable HTTP transports
- Quota-aware tool descriptions

## Development

This project uses the Agent Context Protocol for development:

- `@acp.init` - Initialize agent context
- `@acp.plan` - Plan milestones and tasks
- `@acp.proceed` - Continue with next task
- `@acp.status` - Check project status

See [AGENT.md](./AGENT.md) for complete ACP documentation.

## Project Structure

```
youtube-mcp-server/
├── AGENT.md              # ACP methodology
├── agent/                # ACP directory
│   ├── design/          # Design documents
│   ├── milestones/      # Project milestones
│   ├── tasks/           # Task breakdown
│   ├── patterns/        # Architectural patterns
│   └── progress.yaml    # Progress tracking
└── (your project files)
```

## Getting Started

1. Initialize context: `@acp.init`
2. Plan your project: `@acp.plan`
3. Start building: `@acp.proceed`

## License

MIT

## Author

Patrick Michaelsen
