# NexAgent — Development Rules

## Project Overview

NexAgent is an AI-powered prototype builder for Product Managers. PMs describe products in natural language; an LLM agent generates interactive HTML prototype pages with navigation flows, preview, and export.

**Not production code** — prototypes are semantic HTML + CSS with `data-*` interaction attributes, designed for PM review and handoff to code-agents (Cursor, etc.).

## Architecture

```
Browser ←→ Next.js (packages/web, :3456) ──→ Hono Core (packages/core, :3457) ──→ SQLite + Filesystem
                │                                        │
                │  rewrites or NEXT_PUBLIC_CORE_URL       ↓
                │                                   LLM API (streaming)
                └── SSE /events ──→ EventBus (real-time updates)
```

- **Monorepo**: pnpm workspaces — `packages/core`, `packages/web`
- **Core** (`@nexagent/core`): Hono HTTP server, Vercel AI SDK, SQLite (Drizzle), filesystem
- **Web** (`@nexagent/web`): Next.js 15, React 19, Tailwind CSS v4

## Code Style

### TypeScript
- Strict mode everywhere
- ESM only (`"type": "module"`)
- Prefer `const`; use `let` only when mutation is required
- Prefer `interface` over `type` for object shapes
- No `any` — use `unknown` and narrow
- Early returns; avoid `else` after `return`
- Named exports only (except Next.js page default exports)

### Naming
- Files: `kebab-case.ts` / `kebab-case.tsx`
- Variables, functions: `camelCase`
- Types, interfaces, classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Database columns: `snake_case` (Drizzle convention)

### Imports
- Group: node built-ins → external packages → internal `@/*` aliases
- No circular imports between packages

### Error handling
- Core: return `undefined` or error responses; avoid throwing on expected cases
- Web: catch at boundaries; show user-friendly error in UI

## File Organization

```
packages/
├── core/src/
│   ├── server/      # Hono routes, SSE, CORS
│   ├── session/     # Session CRUD, LLM runner, system prompt
│   ├── project/     # Project/page/flow CRUD (filesystem + manifest)
│   ├── tool/        # Zod-based tool definitions for LLM
│   ├── provider/    # LLM provider factory (Anthropic, OpenAI, compatible)
│   ├── bus/         # In-process EventBus for real-time updates
│   ├── skill/       # Loads SKILL.md from skills/ directory
│   └── storage/     # SQLite database (Drizzle + better-sqlite3)
└── web/src/
    ├── app/         # Next.js App Router pages
    ├── components/
    │   ├── chat/    # Chat panel (streaming, markdown, tool calls, templates)
    │   ├── editor/  # Page tree, flow graph, panorama (ReactFlow), new project dialog
    │   └── preview/ # Preview panel, device frame, interaction engine
    ├── hooks/       # useEventSource, useChatStream, useProjectTheme
    └── lib/
        ├── api.ts       # REST client for core API
        ├── cn.ts        # clsx + tailwind-merge
        ├── i18n.tsx     # i18n provider (zh/en)
        └── store/       # Zustand stores (workspace state)
```

## Key Conventions

### Core API
- All routes return JSON; errors use `{ error: string }` with appropriate HTTP status
- SSE endpoint `/events` relays all EventBus events to connected clients
- Chat is fire-and-forget POST; responses stream via SSE `session.message` events
- ProjectManager is the single authority for project/page/flow data

### Web Frontend
- Single-page workspace: project selection → three-panel editor
- State: local React state for most things; Zustand for cross-component workspace state
- Styling: CSS custom properties (`--color-*`) with dark/light/auto theme support
- i18n: all user-facing strings go through `t()` from `useI18n()`
- No `useEffect` for data fetching when SSE covers it; prefer event-driven updates

### Prototype Format
- Pages: self-contained HTML with `<style>` blocks, no external frameworks
- Interactions: `data-action="navigate"`, `data-target="page-id"`, etc.
- Manifest: `nexagent.json` with pages, navigation, theme, components
- Preview: sandboxed iframe; interaction engine handles `data-*` attributes via `postMessage`

## Development

```bash
pnpm install          # install all dependencies
pnpm dev              # start core (3457) + web (3456) in parallel
pnpm dev:core         # start only core
pnpm dev:web          # start only web
pnpm build            # build all packages
pnpm lint             # typecheck all packages
```

## Do NOT

- Add dependencies to the root `package.json` — add to the specific package
- Import from `packages/core` in `packages/web` — communicate only via HTTP/SSE
- Use `any` types
- Commit `.env`, `*.db`, or `node_modules`
- Add code comments that merely narrate what the code does
