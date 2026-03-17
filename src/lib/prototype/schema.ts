import { z } from "zod";

/**
 * NexAgent Prototype Format Schema
 *
 * This schema defines the structure of nexagent.json — the project manifest
 * that serves as both a human-readable prototype spec and a machine-parseable
 * input for code-generation agents (e.g. Cursor).
 *
 * Design principles:
 * - Declarative: interactions described via data-* attributes, not JS code
 * - Semantic: HTML comments with @page/@description for agent comprehension
 * - Portable: pure HTML+CSS, no framework dependencies
 */

export const ThemeSchema = z.object({
  primaryColor: z.string().default("#4F46E5"),
  backgroundColor: z.string().default("#F9FAFB"),
  foregroundColor: z.string().default("#111827"),
  fontFamily: z.string().default("Inter, system-ui, sans-serif"),
  borderRadius: z.string().default("12px"),
  spacing: z.string().default("16px"),
});

export const AnimationType = z.enum([
  "slide-left",
  "slide-right",
  "fade",
  "modal",
  "none",
]);

export const InteractionType = z.enum([
  "navigate",
  "toast",
  "toggle",
  "single-select",
  "multi-select",
  "swipe-horizontal",
  "modal-open",
  "modal-close",
  "back",
]);

export const NavigationSchema = z.object({
  from: z.string(),
  to: z.string(),
  trigger: z.string().describe("CSS selector + event, e.g. 'click .login-btn'"),
  animation: AnimationType.default("slide-left"),
});

export const ElementTypeEnum = z.enum([
  "button",
  "input",
  "text",
  "image",
  "container",
  "list",
  "nav",
  "other",
]);

export const ElementSchema = z.object({
  id: z.string(),
  name: z.string(),
  selector: z.string(),
  type: ElementTypeEnum.default("other"),
});

export const ComponentRefSchema = z.object({
  id: z.string(),
  file: z.string(),
  usedIn: z.array(z.string()).default([]),
});

export const PageSchema = z.object({
  id: z.string(),
  title: z.string(),
  file: z.string(),
  description: z.string().default(""),
  isEntry: z.boolean().default(false),
  elements: z.array(ElementSchema).default([]),
});

export const ProjectManifestSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  platform: z.enum(["mobile", "web", "desktop"]).default("mobile"),
  theme: ThemeSchema.default({}),
  pages: z.array(PageSchema).default([]),
  navigation: z.array(NavigationSchema).default([]),
  components: z.array(ComponentRefSchema).default([]),
});

export type Theme = z.infer<typeof ThemeSchema>;
export type Navigation = z.infer<typeof NavigationSchema>;
export type PageElement = z.infer<typeof ElementSchema>;
export type PageMeta = z.infer<typeof PageSchema>;
export type ComponentRef = z.infer<typeof ComponentRefSchema>;
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
export type AnimationKind = z.infer<typeof AnimationType>;
export type InteractionKind = z.infer<typeof InteractionType>;
export type ElementType = z.infer<typeof ElementTypeEnum>;

/**
 * Generates theme.css content from a Theme object.
 * This CSS file uses CSS custom properties so pages inherit the design tokens.
 */
export function generateThemeCSS(theme: Theme): string {
  return `/* NexAgent Theme — auto-generated, do not edit manually */
:root {
  --color-primary: ${theme.primaryColor};
  --color-bg: ${theme.backgroundColor};
  --color-fg: ${theme.foregroundColor};
  --font-family: ${theme.fontFamily};
  --border-radius: ${theme.borderRadius};
  --spacing: ${theme.spacing};
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font-family);
  background: var(--color-bg);
  color: var(--color-fg);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

button, input, select, textarea {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
  border: none;
  background: var(--color-primary);
  color: white;
  padding: calc(var(--spacing) * 0.5) var(--spacing);
  border-radius: var(--border-radius);
}

input, textarea {
  border: 1px solid #d1d5db;
  padding: calc(var(--spacing) * 0.5);
  border-radius: var(--border-radius);
  width: 100%;
}
`;
}
