import { z } from "zod";
import type { CoreTool } from "ai";
import type { ProjectManager } from "../project/manager.js";
import { readSkill } from "../skill/index.js";
import type { SkillMeta } from "../skill/index.js";

export interface ToolsContext {
  pm: ProjectManager;
  projectId: string;
  skillsDir: string;
  skills: SkillMeta[];
}

/**
 * Build the tool set available to the Agent.
 * Each tool operates on real files via ProjectManager.
 */
export function buildTools(ctx: ToolsContext): Record<string, CoreTool> {
  const { pm, projectId, skillsDir, skills } = ctx;
  return {
    create_page: {
      description:
        "Create a new prototype page. Generates a complete HTML file with Tailwind CSS and Alpine.js for interactivity. The page content should be a full HTML document.",
      parameters: z.object({
        name: z
          .string()
          .describe(
            "Page title shown in UI. Prefer English (e.g. Home, Product Detail) so the page id slug matches hrefs and avoids broken preview links."
          ),
        content: z.string().describe("Full HTML content of the page"),
        description: z
          .string()
          .optional()
          .describe("Brief description of what this page contains"),
      }),
      execute: async ({ name, content, description }) => {
        const pageId = await pm.createPage(
          projectId,
          name,
          content,
          description || ""
        );
        return `Page "${name}" created successfully with id "${pageId}". It is now available for preview.`;
      },
    },

    edit_page: {
      description:
        "Edit an existing page by substring replacement (not full-file rewrite). old_string must match exactly once unless replace_all is true. Prefer small, unique hunks. Always read_page first if unsure.",
      parameters: z.object({
        page_id: z.string().describe("The page id to edit"),
        old_string: z
          .string()
          .describe("The exact existing text to find and replace"),
        new_string: z
          .string()
          .describe("The replacement text"),
        replace_all: z
          .boolean()
          .optional()
          .describe(
            "If true, replace every occurrence of old_string; if false/omit, only the first match is replaced"
          ),
      }),
      execute: async ({ page_id, old_string, new_string, replace_all }) => {
        const result = await pm.editPage(
          projectId,
          page_id,
          old_string,
          new_string,
          { replaceAll: replace_all === true }
        );
        if (!result.success) {
          return `Edit failed: old_string not found in page "${page_id}". Read the page first to see current content.`;
        }
        const n = result.replacements;
        return `Page "${page_id}" updated: ${n} replacement(s).`;
      },
    },

    rewrite_page: {
      description:
        "Completely rewrite a page with new content. Use this when the changes are too extensive for edit_page.",
      parameters: z.object({
        page_id: z.string().describe("The page id to rewrite"),
        content: z.string().describe("The complete new HTML content"),
      }),
      execute: async ({ page_id, content }) => {
        await pm.writePage(projectId, page_id, content);
        return `Page "${page_id}" has been completely rewritten.`;
      },
    },

    read_page: {
      description:
        "Read the current HTML content of a page. Always read before editing to see the latest content.",
      parameters: z.object({
        page_id: z.string().describe("The page id to read"),
      }),
      execute: async ({ page_id }) => {
        try {
          const content = await pm.readPage(projectId, page_id);
          return content;
        } catch {
          return `Page "${page_id}" not found.`;
        }
      },
    },

    list_pages: {
      description:
        "List all pages in the current project with their names and descriptions.",
      parameters: z.object({}),
      execute: async () => {
        const pages = await pm.listPages(projectId);
        if (pages.length === 0) return "No pages yet. Create the first page!";
        return pages
          .map((p) => `- ${p.id}: ${p.name} — ${p.description || "(no description)"}`)
          .join("\n");
      },
    },

    delete_page: {
      description: "Delete a page from the project.",
      parameters: z.object({
        page_id: z.string().describe("The page id to delete"),
      }),
      execute: async ({ page_id }) => {
        await pm.deletePage(projectId, page_id);
        return `Page "${page_id}" deleted.`;
      },
    },

    list_flows: {
      description:
        "List all recorded navigation relationships (button/link → page) from nexagent.json. Use before remove_flow or to verify update_flow results.",
      parameters: z.object({}),
      execute: async () => {
        const m = await pm.getManifest(projectId);
        if (m.flows.length === 0) {
          return "No flows recorded. Use update_flow after adding data-action/data-target or page-id hrefs on controls.";
        }
        return m.flows
          .map((f) => {
            const el = f.element ? ` [${f.element}]` : "";
            return `- ${f.from}${el} → ${f.to} — ${f.trigger}`;
          })
          .join("\n");
      },
    },

    remove_flow: {
      description:
        "Remove one navigation edge from the manifest. Match from_page, to_page, and optional element_id exactly as in list_flows.",
      parameters: z.object({
        from_page: z.string().describe("Source page id"),
        to_page: z.string().describe("Target page id"),
        element_id: z
          .string()
          .optional()
          .describe(
            "Same as data-nexagent-element on the control; omit only for edges that had no element in list_flows"
          ),
      }),
      execute: async ({ from_page, to_page, element_id }) => {
        const el = element_id?.trim() ?? "";
        let removed = false;
        await pm.updateManifest(projectId, (m) => {
          const before = m.flows.length;
          m.flows = m.flows.filter(
            (f) =>
              !(
                f.from === from_page &&
                f.to === to_page &&
                (f.element ?? "") === el
              )
          );
          removed = m.flows.length < before;
          return m;
        });
        if (!removed) {
          return `No matching flow (${from_page} → ${to_page}${el ? ` [${el}]` : ""}). Use list_flows.`;
        }
        return `Removed flow: ${from_page}${el ? ` [${el}]` : ""} → ${to_page}`;
      },
    },

    update_flow: {
      description:
        "Add or replace one navigation edge from a specific element on the source page to the target page. Match element_id to data-nexagent-element on that page. Call once per distinct button/link; use remove_flow to delete.",
      parameters: z.object({
        from_page: z.string().describe("Source page id"),
        to_page: z.string().describe("Target page id"),
        element_id: z
          .string()
          .optional()
          .describe(
            "English id from data-nexagent-element on the source page (e.g. nav_cart). Omit only for non-click flows (e.g. auto redirect)."
          ),
        trigger: z
          .string()
          .describe("Short human label, e.g. 'Tap cart icon' / '点击结算'"),
      }),
      execute: async ({ from_page, to_page, element_id, trigger }) => {
        const el = element_id?.trim() ?? "";
        await pm.updateManifest(projectId, (m) => {
          m.flows = m.flows.filter(
            (f) =>
              !(
                f.from === from_page &&
                f.to === to_page &&
                (f.element ?? "") === el
              )
          );
          const row: {
            from: string;
            to: string;
            trigger: string;
            element?: string;
          } = { from: from_page, to: to_page, trigger };
          if (el) row.element = el;
          m.flows.push(row);
          return m;
        });
        const tag = el ? `[${el}] ` : "";
        return `Flow added: ${from_page} ${tag}→ ${to_page} (${trigger})`;
      },
    },

    update_theme: {
      description: "Update the project's visual theme.",
      parameters: z.object({
        primary: z.string().optional().describe("Primary color hex, e.g. '#3B82F6'"),
        bg: z.string().optional().describe("Background color hex"),
        radius: z.string().optional().describe("Border radius, e.g. '12px'"),
        font: z.string().optional().describe("Font family name"),
      }),
      execute: async (updates) => {
        await pm.updateManifest(projectId, (m) => {
          if (updates.primary) m.theme.primary = updates.primary;
          if (updates.bg) m.theme.bg = updates.bg;
          if (updates.radius) m.theme.radius = updates.radius;
          if (updates.font) m.theme.font = updates.font;
          return m;
        });
        return `Theme updated: ${JSON.stringify(updates)}`;
      },
    },

    load_skill: {
      description:
        "Load a skill's full content by name. Skills provide detailed design patterns and component specifications for specific app types (e.g. ecommerce, social, dashboard). Available skills: " +
        skills.map((s) => s.name).join(", "),
      parameters: z.object({
        name: z
          .string()
          .describe("The skill name to load, e.g. 'ecommerce', 'social', 'dashboard'"),
      }),
      execute: async ({ name }) => {
        const content = await readSkill(skillsDir, name);
        if (!content) {
          return `Skill "${name}" not found. Available skills: ${skills.map((s) => s.name).join(", ")}`;
        }
        return content;
      },
    },

    update_rules: {
      description:
        "Create or update the project's PROTOTYPE_RULES.md file. This file contains project-level design conventions and constraints that apply to all pages.",
      parameters: z.object({
        content: z
          .string()
          .describe("The full markdown content for the project rules file"),
      }),
      execute: async ({ content }) => {
        await pm.writeRules(projectId, content);
        return "Project rules (PROTOTYPE_RULES.md) updated successfully. These rules will be applied to all future page generations.";
      },
    },
  };
}
