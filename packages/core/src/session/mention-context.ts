import type { ProjectManager } from "../project/manager.js";

/**
 * Matches @pageId or @pageId:element_id as inserted by the chat composer.
 * Page ids come from slugifyPageName; elements use snake_case / data-nexagent-element pattern.
 */
const CHAT_MENTION_RE =
  /@([a-z0-9\u4e00-\u9fff-]+)(?::([a-zA-Z][a-zA-Z0-9_-]*))?/g;

function snippetAroundElement(html: string, elementId: string): string | null {
  const esc = elementId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `data-nexagent-element\\s*=\\s*["']${esc}["']`,
    "i"
  );
  const m = re.exec(html);
  if (!m || m.index === undefined) return null;
  const idx = m.index;
  const start = Math.max(0, idx - 120);
  const end = Math.min(html.length, idx + m[0].length + 200);
  return html.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Appends structured context for @page and @page:element tokens so the model
 * can resolve mentions without guessing ids. Not persisted on the user row.
 */
export async function buildMentionContextSuffix(
  pm: ProjectManager,
  projectId: string,
  userMessage: string
): Promise<string> {
  const manifest = await pm.getManifest(projectId);
  const pageById = new Map(manifest.pages.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const sections: string[] = [];

  const re = new RegExp(CHAT_MENTION_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(userMessage)) !== null) {
    const pageId = m[1];
    const elementId = m[2];
    const key = elementId ? `${pageId}:${elementId}` : pageId;
    if (seen.has(key)) continue;
    seen.add(key);

    const meta = pageById.get(pageId);
    if (!meta) {
      sections.push(
        `### @${key}\nUnknown page id (not in manifest). Use list_pages to see valid ids.`
      );
      continue;
    }

    let block = `### @${key}\n- **page_id**: \`${pageId}\`\n- **name**: ${meta.name}\n- **description**: ${meta.description || "(none)"}`;
    if (elementId) {
      try {
        const html = await pm.readPage(projectId, pageId);
        const snip = snippetAroundElement(html, elementId);
        if (!snip) {
          block += `\n- **element_id**: \`${elementId}\` — not found in HTML (verify spelling; call read_page).`;
        } else {
          block += `\n- **element_id**: \`${elementId}\`\n- **surrounding HTML** (truncated): \`${snip}\``;
        }
      } catch {
        block += `\n- **element_id**: \`${elementId}\` — could not read page file.`;
      }
    }
    sections.push(block);
  }

  if (sections.length === 0) return "";

  return `<resolved_mentions>
The user referenced these targets with @ in chat. Use **page_id** and **element_id** exactly as given in tool arguments.

${sections.join("\n\n")}
</resolved_mentions>`;
}
