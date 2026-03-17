---
description: NexAgent system architecture — module responsibilities and data flow
globs: ["packages/**/*.ts", "packages/**/*.tsx"]
---

# Architecture Guide

## System Overview

NexAgent is a pnpm monorepo with two packages:

| Package | Port | Stack | Role |
|---------|------|-------|------|
| `@nexagent/core` | 3457 | Hono + AI SDK + SQLite | Backend API, LLM agent, project storage |
| `@nexagent/web` | 3456 | Next.js 15 + React 19 | Frontend workspace UI |

Communication: Web → Core via REST (proxied through Next.js rewrites) and SSE (`/events`).

## packages/core — Module Map

| Module | File(s) | Responsibility |
|--------|---------|---------------|
| **Server** | `src/server/server.ts` | Hono app: REST routes, SSE `/events`, CORS, health |
| **Session** | `src/session/index.ts` | SessionManager: CRUD for sessions and messages (SQLite) |
| **Runner** | `src/session/runner.ts` | Agent turn: system prompt → `streamText()` → tool execution → SSE deltas |
| **System Prompt** | `src/session/system-prompt.ts` | Assembles prompt from manifest, skills, and project rules |
| **Tools** | `src/tool/registry.ts` | Zod tool schemas for LLM: create_page, edit_page, rewrite_page, etc. |
| **Provider** | `src/provider/index.ts` | LLM factory: Anthropic, OpenAI, OpenAI-compatible, Qwen |
| **Project** | `src/project/manager.ts` | ProjectManager: CRUD for projects, pages, flows, themes (filesystem) |
| **Bus** | `src/bus/index.ts` | Typed EventBus with `onAll()` for SSE relay |
| **Skill** | `src/skill/index.ts` | Loads `SKILL.md` definitions from skills directory |
| **Storage** | `src/storage/db.ts` | SQLite via better-sqlite3 + Drizzle ORM |

## packages/web — Module Map

| Module | File(s) | Responsibility |
|--------|---------|---------------|
| **App** | `src/app/page.tsx` | Main workspace: project selector → three-panel editor |
| **Chat** | `src/components/chat/chat-panel.tsx` | Streaming chat with markdown, tool call cards, templates |
| **Page Tree** | `src/components/editor/page-tree.tsx` | Page list with active indicator |
| **Flow Graph** | `src/components/editor/flow-graph.tsx` | Compact flow visualization in sidebar |
| **Panorama** | `src/components/editor/panorama.tsx` | ReactFlow-based page map with thumbnails |
| **Preview** | `src/components/preview/preview-panel.tsx` | Sandboxed iframe preview with device frame |
| **Device Frame** | `src/components/preview/device-frame.tsx` | Mobile/desktop device simulation chrome |
| **Interaction** | `src/components/preview/interaction-engine.ts` | Protocol types for `data-action` / `data-interaction` |
| **SSE Hooks** | `src/hooks/use-event-source.ts` | `useEventSource()` + `useChatStream()` |
| **Theme Hook** | `src/hooks/use-project-theme.ts` | Dynamic CSS variable theming (light/dark/auto) |
| **API Client** | `src/lib/api.ts` | REST client for all core endpoints |
| **i18n** | `src/lib/i18n.tsx` | I18nProvider with zh/en translations |
| **Store** | `src/lib/store/workspace.ts` | Zustand workspace state (page selection, panel toggles) |

## Data Flow

```
1. User types message in ChatPanel
2. useChatStream.send() POSTs to core /api/sessions/:sessionId/chat
3. Core builds system prompt (manifest + skills + rules) → calls LLM via streamText()
4. LLM text deltas → EventBus emits session.message → SSE relays to browser
5. LLM tool calls (create_page, edit_page) → ProjectManager writes files
6. ProjectManager → EventBus emits page.created / page.updated
7. SSE /events → browser receives event → refreshes page tree + preview
8. Final session.message with done=true → chat stops streaming
```

## Key Invariants

- ProjectManager is the single authority for project data (filesystem + manifest)
- EventBus is the single source for real-time updates (never poll)
- Core never imports from web; web never imports from core
- `NEXT_PUBLIC_CORE_URL` controls direct vs proxy mode
- Next.js `beforeFiles` rewrites proxy `/api/*`, `/events`, `/preview/*`, `/share/*` to core
