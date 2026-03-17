---
description: Frontend conventions for packages/web — React, styling, state, i18n
globs: ["packages/web/**/*.ts", "packages/web/**/*.tsx", "packages/web/**/*.css"]
---

# Frontend Conventions

## Stack

- Next.js 15 (App Router, server components disabled — all pages are `"use client"`)
- React 19
- Tailwind CSS v4 (via `@tailwindcss/postcss`)
- Zustand for cross-component state
- Lucide React for icons

## Styling

Use CSS custom properties defined in `globals.css`. Never hardcode colors.

```tsx
// Good
className="bg-[var(--color-surface)] text-[var(--color-text)]"
className="border-[var(--color-border)] hover:border-[var(--color-accent)]"

// Bad
className="bg-gray-900 text-white"
className="border-gray-700"
```

Available variables:
- `--color-bg`, `--color-surface`, `--color-surface-2` — background layers
- `--color-border` — borders and dividers
- `--color-text`, `--color-text-secondary` — text colors
- `--color-accent`, `--color-accent-hover` — primary action color

Use `cn()` from `@/lib/cn` for conditional classes:

```tsx
import { cn } from "@/lib/cn";
className={cn("base-classes", condition && "conditional-classes")}
```

## State Management

- **Local state** (`useState`): UI state scoped to a single component
- **Zustand** (`useWorkspaceStore`): shared state across workspace (page selection, panel visibility, navigation history)
- **SSE events** (`useEventSource`): real-time data from core (page updates, chat deltas, tool calls)

Do NOT use `useEffect` to poll data. Prefer SSE event-driven updates.

## i18n

All user-facing strings must use the `t()` function from `useI18n()`.

```tsx
const { t } = useI18n();
<span>{t("app.pages")}</span>
```

Add new keys to both `zh` and `en` in `src/lib/i18n.tsx`.

## API Calls

Use the `api` client from `@/lib/api`:

```tsx
import { api } from "@/lib/api";
const pages = await api.listPages(projectId);
```

Never construct fetch URLs manually. Add new endpoints to `api.ts`.

## Component Patterns

- Icons: use Lucide React, size 12–18 for UI chrome
- Buttons: use CSS variable-based styling, not Tailwind color classes
- Panels: collapsible with state in parent or Zustand
- Modals: render at component level with `fixed inset-0` overlay

## File Naming

- Components: `kebab-case.tsx` (e.g., `chat-panel.tsx`, `device-frame.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-event-source.ts`)
- Stores: `kebab-case.ts` in `lib/store/` (e.g., `workspace.ts`)
