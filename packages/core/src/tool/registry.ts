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
        name: z.string().describe("Human-readable page name, e.g. '首页', 'Product List'"),
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
        "Edit an existing page by replacing a specific string with new content. Use this for targeted modifications. The old_string must match exactly (including whitespace).",
      parameters: z.object({
        page_id: z.string().describe("The page id to edit"),
        old_string: z
          .string()
          .describe("The exact existing text to find and replace"),
        new_string: z
          .string()
          .describe("The replacement text"),
      }),
      execute: async ({ page_id, old_string, new_string }) => {
        const result = await pm.editPage(
          projectId,
          page_id,
          old_string,
          new_string
        );
        if (!result.success) {
          return `Edit failed: old_string not found in page "${page_id}". Read the page first to see current content.`;
        }
        return `Page "${page_id}" updated successfully.`;
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

    update_flow: {
      description:
        "Add or update a navigation flow between two pages. This records how users navigate between pages.",
      parameters: z.object({
        from_page: z.string().describe("Source page id"),
        to_page: z.string().describe("Target page id"),
        trigger: z
          .string()
          .describe("What user action triggers this navigation, e.g. '点击商品卡片'"),
      }),
      execute: async ({ from_page, to_page, trigger }) => {
        await pm.updateManifest(projectId, (m) => {
          m.flows = m.flows.filter(
            (f) => !(f.from === from_page && f.to === to_page)
          );
          m.flows.push({ from: from_page, to: to_page, trigger });
          return m;
        });
        return `Flow added: ${from_page} → ${to_page} (trigger: ${trigger})`;
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
