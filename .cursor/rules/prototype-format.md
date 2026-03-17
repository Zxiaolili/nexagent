---
description: Prototype format — the data model for generated HTML prototypes
globs: ["packages/core/src/project/**", "packages/core/src/tool/**", "packages/core/src/session/system-prompt.ts", "skills/**"]
---

# Prototype Format

## Overview

NexAgent generates interactive HTML prototypes as the bridge between PM intent and production code. The format is:

1. **Human-readable** — PMs preview prototypes in the browser
2. **Machine-parseable** — code-agents read `nexagent.json` as a spec
3. **Interactive** — preview engine interprets `data-*` attributes
4. **Portable** — pure HTML+CSS, no framework dependencies

## Project Manifest (`nexagent.json`)

```json
{
  "name": "App Name",
  "description": "What this app does",
  "platform": "mobile | web | desktop",
  "theme": {
    "primaryColor": "#4F46E5",
    "backgroundColor": "#F9FAFB",
    "foregroundColor": "#111827",
    "fontFamily": "Inter, system-ui, sans-serif",
    "borderRadius": "12px",
    "spacing": "16px"
  },
  "pages": [
    { "id": "home", "title": "首页", "file": "pages/home.html", "description": "...", "isEntry": true }
  ],
  "navigation": [
    { "from": "home", "to": "detail", "trigger": "click .product-card", "animation": "slide-left" }
  ],
  "components": []
}
```

## Page HTML Format

```html
<!--
  @page: {kebab-case-id}
  @title: {Human readable title}
  @description: {Purpose and key elements}
-->
<div class="page" data-page="{page-id}">
  <header>...</header>
  <main>...</main>
  <footer>...</footer>
</div>
```

Rules for generated HTML:
- Semantic HTML5 elements (header, main, nav, section, footer)
- Inline `<style>` blocks — no external CSS frameworks
- CSS custom properties from theme (`--color-primary`, `--color-bg`, `--color-fg`)
- Mobile-first (375px) unless platform is "web" or "desktop"
- Realistic placeholder content, not "Lorem ipsum"

## Interaction Protocol

The preview engine interprets these `data-*` attributes:

| Attribute | Value | Effect |
|-----------|-------|--------|
| `data-action="navigate"` | `data-target="{pageId}"` | Navigate to another page |
| `data-action="back"` | — | Return to previous page |
| `data-action="toast"` | `data-message="{text}"` | Show toast notification |
| `data-action="toggle"` | `data-target="{elementId}"` | Toggle element visibility |
| `data-action="modal-open"` | `data-target="{modalId}"` | Open a modal |
| `data-action="modal-close"` | — | Close current modal |
| `data-interaction="single-select"` | — | Single selection in group |
| `data-interaction="multi-select"` | — | Multi selection in group |
| `data-interaction="swipe-horizontal"` | — | Swipeable container |

## Tool→Prototype Mapping

Each LLM tool in `packages/core/src/tool/registry.ts` maps to a ProjectManager operation:

| Tool | ProjectManager method | EventBus event |
|------|----------------------|----------------|
| `create_page` | `createPage()` | `page.created` |
| `edit_page` | `editPage()` | `page.updated` |
| `rewrite_page` | `rewritePage()` | `page.updated` |
| `delete_page` | `deletePage()` | `page.deleted` |
| `update_flow` | `updateFlows()` | `project.updated` |
| `update_theme` | `updateTheme()` | `project.updated` |

## Skills

Skills are domain-specific design guidelines loaded from `skills/{name}/SKILL.md`. The `load_skill` tool reads a skill and appends its content to the system prompt for the current session.

Available built-in skills:
- `ecommerce` — E-commerce app design patterns
- `social` — Social app design patterns
- `dashboard` — Admin dashboard design patterns
