# NexAgent

[中文](README.zh-CN.md)

AI-powered prototype builder for Product Managers. Describe your product in natural language, get interactive HTML prototypes.

## Features

- **Conversational prototyping** — describe your app, get interactive HTML pages
- **Multi-page navigation** — automatic page linking, flow graphs, panorama view
- **Real-time preview** — mobile/desktop device modes, fullscreen, interactive elements
- **Multi-session chat** — multiple conversations per project, session history
- **Streaming AI** — real-time SSE streaming with tool call visualization
- **Panorama view** — ReactFlow-based page map with thumbnails and navigation edges
- **Export & share** — download ZIP, shareable preview links
- **Multi-provider LLM** — Anthropic, OpenAI, or any OpenAI-compatible API
- **i18n** — Chinese and English UI
- **Dark/light theme** — auto, dark, or light mode with project-aware theming

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm (`corepack enable`)

### Development

```bash
git clone https://github.com/your-org/nexagent.git
cd nexagent
pnpm install

# Configure LLM provider
cp .env.example .env
# Edit .env with your API key

# Start dev servers (core + web in parallel)
pnpm dev
```

- **Web UI**: http://localhost:3456
- **Core API**: http://localhost:3457

### Docker

```bash
cp .env.example .env
# Edit .env with your API key

docker compose up -d
```

Data is persisted via mounted volumes:
- `./data` — SQLite database (sessions, messages)
- `./projects` — generated prototype files

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `NEXAGENT_PROVIDER` | `anthropic` / `openai` / `openai-compatible` / `qwen` | `anthropic` |
| `NEXAGENT_MODEL` | Model name | `claude-sonnet-4-20250514` |
| `NEXAGENT_API_KEY` | API key for openai-compatible | — |
| `NEXAGENT_BASE_URL` | Base URL for openai-compatible | — |
| `NEXAGENT_PORT` | Core server port | `3457` |
| `NEXAGENT_PROJECTS_DIR` | Projects storage directory | `~/nexagent-projects` |
| `NEXAGENT_DATA_DIR` | Data directory (SQLite DB) | `~/.nexagent/data` |
| `NEXAGENT_SKILLS_DIR` | Skills directory | `./skills` |
| `NEXT_PUBLIC_CORE_URL` | Core URL for web frontend | `http://localhost:3457` |

## Project Structure

```
nexagent/
├── packages/
│   ├── core/              # @nexagent/core — Hono API + LLM agent
│   │   └── src/
│   │       ├── server/        # HTTP routes & SSE
│   │       ├── session/       # Conversation state & LLM runner
│   │       ├── project/       # Project/page/flow management
│   │       ├── tool/          # Agent tool definitions
│   │       ├── provider/      # LLM provider abstraction
│   │       ├── bus/           # Real-time event bus
│   │       ├── skill/         # Skill loader
│   │       └── storage/       # SQLite database
│   └── web/               # @nexagent/web — Next.js 15 frontend
│       └── src/
│           ├── app/           # App Router pages
│           ├── components/
│           │   ├── chat/      # Chat panel
│           │   ├── editor/    # Page tree, flow graph, panorama
│           │   └── preview/   # Preview, device frame
│           ├── hooks/         # SSE, theme hooks
│           └── lib/           # API client, i18n, stores
├── skills/                # Built-in prototype skills
├── Dockerfile
├── docker-compose.yml
└── start.sh
```

## Architecture

- **Core**: Hono HTTP server + SQLite (Drizzle ORM) + filesystem storage
- **Web**: Next.js 15 + React 19 + Tailwind CSS v4 + Zustand
- **LLM**: Vercel AI SDK with streaming + multi-step tool calls
- **Real-time**: Server-Sent Events (SSE) via EventBus

## License

MIT
