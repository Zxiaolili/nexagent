import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { bus } from "../bus/index.js";
import { ProjectManager, slugifyPageName } from "../project/manager.js";
import { SessionManager } from "../session/index.js";
import { runAgent } from "../session/runner.js";
import { getDb } from "../storage/db.js";
import type { ProviderConfig } from "../provider/index.js";
import fs from "fs/promises";
import path from "path";
import archiver from "archiver";
import { nanoid } from "nanoid";
import { Readable } from "stream";

const activeAgents = new Map<string, AbortController>();

export interface ServerConfig {
  projectsRoot: string;
  dataDir: string;
  skillsDir: string;
  provider?: Partial<ProviderConfig>;
}

interface ApiError {
  error: string;
  code: string;
}

function apiError(message: string, code: string, status: number, c: any) {
  return c.json({ error: message, code } satisfies ApiError, status);
}

const NEXAGENT_ELEMENT_RE =
  /data-nexagent-element\s*=\s*["']([a-zA-Z][a-zA-Z0-9_-]*)["']/gi;

function extractNexagentElements(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of html.matchAll(NEXAGENT_ELEMENT_RE)) {
    const id = m[1];
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function buildPreviewNavScript(manifest: {
  pages: { id: string; name: string }[];
}): string {
  const ids = manifest.pages.map((p) => p.id);
  const nameSlugToId: Record<string, string> = {};
  for (const p of manifest.pages) {
    nameSlugToId[slugifyPageName(p.name)] = p.id;
  }
  const idsJson = JSON.stringify(ids);
  const slugJson = JSON.stringify(nameSlugToId);
  return `<script>
(function(){
var IDS=${idsJson};
var LOWER={};
IDS.forEach(function(id){LOWER[String(id).toLowerCase()]=id;});
var NAME_SLUG=${slugJson};
function slug(s){
return String(s).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'-').replace(/^-|-$/g,'');
}
function resolveTarget(raw){
if(raw==null||raw==='')return null;
var href=String(raw).trim();
try{href=decodeURIComponent(href);}catch(e){}
href=href.split('#')[0].split('?')[0];
var seg=href.replace(/^.*\\//,'').replace(/^\\.\\//,'');
if(!seg)return null;
var base=seg.replace(/\\.html$/i,'');
if(IDS.indexOf(base)>=0)return base;
var lo=LOWER[base.toLowerCase()];
if(lo)return lo;
var sl=slug(base);
if(NAME_SLUG[sl])return NAME_SLUG[sl];
if(NAME_SLUG[slug(seg)])return NAME_SLUG[slug(seg)];
return null;
}
function postNav(target){
var id=resolveTarget(target);
if(!id){console.warn('[NexAgent] Unknown navigation target:',target);return;}
window.parent.postMessage({type:'nexagent:navigate',pageId:id},'*');
}
document.addEventListener('click',function(e){
var n=e.target.closest('[data-action="navigate"]');
if(n){
var t=n.getAttribute('data-target');
if(t){e.preventDefault();e.stopPropagation();postNav(t);return;}
}
n=e.target.closest('[data-nav]');
if(n){
var dn=n.getAttribute('data-nav');
if(dn){e.preventDefault();e.stopPropagation();postNav(dn);return;}
}
var a=e.target.closest('a[href]');
if(!a)return;
var href=a.getAttribute('href');
if(!href||/^https?:|^#|^javascript/i.test(href))return;
e.preventDefault();
postNav(href);
},true);
})();
</script>`;
}

export function createServer(config: ServerConfig) {
  const db = getDb(config.dataDir);
  const pm = new ProjectManager(config.projectsRoot);
  const sm = new SessionManager(db);
  const app = new Hono();

  app.use("/*", cors());

  // ─── Health ───
  app.get("/health", (c) => c.json({ ok: true, version: "0.1.0" }));

  // ─── SSE Event Stream ───
  app.get("/events", (c) => {
    return streamSSE(c, async (stream) => {
      const unsub = bus.onAll((event, data) => {
        stream.writeSSE({ event, data: JSON.stringify(data) });
      });
      // keep-alive
      const interval = setInterval(() => {
        stream.writeSSE({ event: "ping", data: "{}" });
      }, 15000);
      stream.onAbort(() => {
        unsub();
        clearInterval(interval);
      });
      // block until aborted
      await new Promise(() => {});
    });
  });

  // ─── Projects ───
  app.get("/api/projects", async (c) => {
    try {
      const projects = await pm.listProjects();
      return c.json(projects);
    } catch (err: unknown) {
      return apiError((err as Error).message || "Failed to list projects", "LIST_PROJECTS_ERROR", 500, c);
    }
  });

  app.post("/api/projects", async (c) => {
    try {
      const body = await c.req.json<{ name: string }>();
      if (!body.name?.trim()) {
        return apiError("Project name is required", "VALIDATION_ERROR", 400, c);
      }
      const id = await pm.createProject(body.name);
      return c.json({ id, name: body.name }, 201);
    } catch (err: unknown) {
      return apiError((err as Error).message || "Failed to create project", "CREATE_PROJECT_ERROR", 500, c);
    }
  });

  app.get("/api/projects/:id", async (c) => {
    const id = c.req.param("id");
    try {
      const manifest = await pm.getManifest(id);
      return c.json({ id, ...manifest });
    } catch {
      return apiError("Project not found", "PROJECT_NOT_FOUND", 404, c);
    }
  });

  // ─── Pages ───
  app.get("/api/projects/:projectId/pages", async (c) => {
    try {
      const projectId = c.req.param("projectId");
      const pages = await pm.listPages(projectId);
      return c.json(pages);
    } catch (err: unknown) {
      return apiError((err as Error).message || "Failed to list pages", "LIST_PAGES_ERROR", 500, c);
    }
  });

  app.get("/api/projects/:projectId/pages/:pageId", async (c) => {
    const { projectId, pageId } = c.req.param();
    try {
      const content = await pm.readPage(projectId, pageId);
      return c.json({ id: pageId, content });
    } catch {
      return apiError("Page not found", "PAGE_NOT_FOUND", 404, c);
    }
  });

  app.get("/api/projects/:projectId/page-elements", async (c) => {
    const projectId = c.req.param("projectId");
    try {
      const manifest = await pm.getManifest(projectId);
      const rows: { pageId: string; pageName: string; elements: string[] }[] = [];
      for (const p of manifest.pages) {
        try {
          const html = await pm.readPage(projectId, p.id);
          rows.push({
            pageId: p.id,
            pageName: p.name,
            elements: extractNexagentElements(html),
          });
        } catch {
          rows.push({ pageId: p.id, pageName: p.name, elements: [] });
        }
      }
      return c.json(rows);
    } catch (err: unknown) {
      return apiError(
        (err as Error).message || "Failed to list page elements",
        "LIST_PAGE_ELEMENTS_ERROR",
        500,
        c
      );
    }
  });

  // ─── Files ───
  app.get("/api/projects/:projectId/files", async (c) => {
    try {
      const projectId = c.req.param("projectId");
      const files = await pm.listFiles(projectId);
      return c.json(files);
    } catch (err: unknown) {
      return apiError((err as Error).message || "Failed to list files", "LIST_FILES_ERROR", 500, c);
    }
  });

  // ─── Preview: serve HTML with navigation interception ───
  app.get("/preview/:projectId/:pageId", async (c) => {
    const { projectId, pageId } = c.req.param();
    try {
      let content = await pm.readPage(projectId, pageId);
      const manifest = await pm.getManifest(projectId);
      const navScript = buildPreviewNavScript(manifest);
      content = content.replace("</body>", navScript + "\n</body>");
      return c.html(content);
    } catch {
      return c.html("<h1>Page not found</h1>", 404);
    }
  });

  // ─── Sessions ───
  app.get("/api/projects/:projectId/sessions", async (c) => {
    try {
      const projectId = c.req.param("projectId");
      const sessions = sm.listByProject(projectId);
      return c.json(sessions);
    } catch (err: unknown) {
      return apiError((err as Error).message || "Failed to list sessions", "LIST_SESSIONS_ERROR", 500, c);
    }
  });

  app.post("/api/projects/:projectId/sessions", async (c) => {
    try {
      const projectId = c.req.param("projectId");
      const body = await c.req.json<{ title?: string }>().catch(() => ({ title: undefined }));
      const session = sm.create(projectId, body.title ?? "");
      return c.json(session, 201);
    } catch (err: unknown) {
      return apiError((err as Error).message || "Failed to create session", "CREATE_SESSION_ERROR", 500, c);
    }
  });

  app.get("/api/sessions/:sessionId/messages", async (c) => {
    try {
      const sessionId = c.req.param("sessionId");
      const messages = sm.getMessages(sessionId);
      return c.json(messages);
    } catch (err: unknown) {
      return apiError((err as Error).message || "Failed to get messages", "GET_MESSAGES_ERROR", 500, c);
    }
  });

  // ─── Chat (fire-and-forget; responses stream via /events SSE) ───
  app.post("/api/sessions/:sessionId/chat", async (c) => {
    const sessionId = c.req.param("sessionId");
    try {
      const body = await c.req.json<{ message: string }>();
      if (!body.message?.trim()) {
        return apiError("Message is required", "VALIDATION_ERROR", 400, c);
      }
      const session = sm.get(sessionId);
      if (!session) {
        return apiError("Session not found", "SESSION_NOT_FOUND", 404, c);
      }

      // Abort any previously running agent for this session
      activeAgents.get(sessionId)?.abort();
      const ac = new AbortController();
      activeAgents.set(sessionId, ac);

      // Fire-and-forget: runAgent emits events via EventBus → /events SSE
      runAgent(pm, sm, {
        sessionId,
        projectId: session.projectId,
        userMessage: body.message,
        skillsDir: config.skillsDir,
        providerConfig: config.provider,
        signal: ac.signal,
      })
        .catch((err: unknown) => {
          console.error("[chat] runAgent error", { sessionId, err: (err as Error).message });
          const { message } = classifyLLMError(err);
          bus.emit("session.error", { sessionId, error: message });
        })
        .finally(() => {
          if (activeAgents.get(sessionId) === ac) activeAgents.delete(sessionId);
        });

      return c.json({ ok: true });
    } catch (err: unknown) {
      return apiError((err as Error).message || "Chat request failed", "CHAT_ERROR", 500, c);
    }
  });

  // ─── Cancel running agent ───
  app.post("/api/sessions/:sessionId/cancel", (c) => {
    const sessionId = c.req.param("sessionId");
    const ac = activeAgents.get(sessionId);
    if (ac) {
      ac.abort();
      activeAgents.delete(sessionId);
    }
    return c.json({ ok: true });
  });

  // ─── Export JSON ───
  app.get("/api/projects/:projectId/export", async (c) => {
    const projectId = c.req.param("projectId");
    try {
      const manifest = await pm.getManifest(projectId);
      const pages: Record<string, string> = {};
      for (const page of manifest.pages) {
        pages[page.id] = await pm.readPage(projectId, page.id);
      }
      return c.json({ manifest, pages });
    } catch {
      return apiError("Project not found", "PROJECT_NOT_FOUND", 404, c);
    }
  });

  // ─── Download ZIP ───
  app.get("/api/projects/:projectId/download", async (c) => {
    const projectId = c.req.param("projectId");
    try {
      const manifest = await pm.getManifest(projectId);
      const projectDir = pm.getProjectDir(projectId);

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.directory(projectDir, manifest.name || projectId);
      archive.finalize();

      const nodeStream = archive as unknown as Readable;
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

      return new Response(webStream, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(manifest.name || projectId)}.zip"`,
        },
      });
    } catch {
      return apiError("Project not found", "PROJECT_NOT_FOUND", 404, c);
    }
  });

  // ─── Share ───
  app.post("/api/projects/:projectId/share", async (c) => {
    try {
      const projectId = c.req.param("projectId");
      try {
        await pm.getManifest(projectId);
      } catch {
        return apiError("Project not found", "PROJECT_NOT_FOUND", 404, c);
      }

      const existing = db
        .prepare("SELECT token FROM shares WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(projectId) as { token: string } | undefined;

      if (existing) {
        return c.json({ token: existing.token });
      }

      const token = nanoid(12);
      const id = nanoid();
      db.prepare(
        "INSERT INTO shares (id, project_id, token) VALUES (?, ?, ?)"
      ).run(id, projectId, token);

      return c.json({ token }, 201);
    } catch (err: unknown) {
      return apiError((err as Error).message || "Failed to share project", "SHARE_ERROR", 500, c);
    }
  });

  // ─── Public share preview ───
  app.get("/share/:token", async (c) => {
    const token = c.req.param("token");
    const row = db
      .prepare("SELECT project_id FROM shares WHERE token = ?")
      .get(token) as { project_id: string } | undefined;

    if (!row) {
      return c.html("<h1>Share link not found or expired</h1>", 404);
    }

    const projectId = row.project_id;
    let manifest;
    try {
      manifest = await pm.getManifest(projectId);
    } catch {
      return c.html("<h1>Project not found</h1>", 404);
    }

    const pagesJson = JSON.stringify(
      manifest.pages.map((p) => ({ id: p.id, name: p.name }))
    );

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${manifest.name} — NexAgent Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; height: 100vh; display: flex; flex-direction: column; }
    .preview-frame { flex: 1; border: none; width: 100%; }
    .nav-bar { display: flex; align-items: center; gap: 4px; padding: 8px 16px; background: #fff; border-top: 1px solid #e5e5e5; overflow-x: auto; }
    .nav-btn { padding: 6px 16px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fff; font-size: 13px; cursor: pointer; white-space: nowrap; transition: all 0.15s; color: #333; }
    .nav-btn:hover { border-color: #3B82F6; color: #3B82F6; }
    .nav-btn.active { background: #3B82F6; color: #fff; border-color: #3B82F6; }
    .brand { margin-left: auto; font-size: 11px; color: #aaa; padding: 0 8px; }
  </style>
</head>
<body>
  <iframe id="preview" class="preview-frame" src="/preview/${projectId}/${manifest.pages[0]?.id || ''}"></iframe>
  <nav class="nav-bar" id="nav"></nav>
  <script>
    var pages = ${pagesJson};
    var projectId = ${JSON.stringify(projectId)};
    var currentPage = pages.length > 0 ? pages[0].id : null;

    function renderNav() {
      var nav = document.getElementById('nav');
      nav.innerHTML = '';
      pages.forEach(function(p) {
        var btn = document.createElement('button');
        btn.className = 'nav-btn' + (p.id === currentPage ? ' active' : '');
        btn.textContent = p.name;
        btn.onclick = function() { navigateTo(p.id); };
        nav.appendChild(btn);
      });
      var brand = document.createElement('span');
      brand.className = 'brand';
      brand.textContent = 'Powered by NexAgent';
      nav.appendChild(brand);
    }

    function navigateTo(pageId) {
      currentPage = pageId;
      document.getElementById('preview').src = '/preview/' + projectId + '/' + pageId;
      renderNav();
    }

    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'nexagent:navigate') {
        navigateTo(e.data.pageId);
      }
    });

    renderNav();
  </script>
</body>
</html>`);
  });

  return app;
}

function classifyLLMError(err: unknown): { message: string; code: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("api key") || lower.includes("apikey") || lower.includes("unauthorized") || lower.includes("401") || lower.includes("authentication")) {
    return { message: "API Key 无效或已过期，请检查环境变量中的 API Key 配置", code: "INVALID_API_KEY" };
  }
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many requests")) {
    return { message: "API 调用频率超限，请稍后重试", code: "RATE_LIMIT" };
  }
  if (lower.includes("token") && (lower.includes("limit") || lower.includes("exceed") || lower.includes("maximum"))) {
    return { message: "对话内容过长，已超出模型 Token 限制。请新建会话后重试", code: "TOKEN_LIMIT" };
  }
  if (lower.includes("context length") || lower.includes("context_length")) {
    return { message: "对话内容过长，已超出模型上下文限制。请新建会话后重试", code: "CONTEXT_LENGTH" };
  }
  if (lower.includes("network") || lower.includes("econnrefused") || lower.includes("enotfound") || lower.includes("fetch failed") || lower.includes("socket") || lower.includes("timeout")) {
    return { message: "网络连接失败，请检查网络连接和 API 地址配置", code: "NETWORK_ERROR" };
  }
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist"))) {
    return { message: "模型不存在，请检查 NEXAGENT_MODEL 配置", code: "MODEL_NOT_FOUND" };
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("server error") || lower.includes("overloaded")) {
    return { message: "LLM 服务暂时不可用，请稍后重试", code: "LLM_SERVER_ERROR" };
  }
  if (lower.includes("unknown provider")) {
    return { message: "不支持的 Provider，请使用 anthropic / openai / openai-compatible / qwen", code: "UNKNOWN_PROVIDER" };
  }

  return { message: raw || "未知错误，请重试", code: "UNKNOWN_ERROR" };
}
