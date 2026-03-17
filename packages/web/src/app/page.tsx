"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { type PageItem } from "@/components/editor/page-tree";
import { type FlowDef } from "@/components/editor/flow-graph";
import { PreviewPanel } from "@/components/preview/preview-panel";
import {
  ChatPanel,
  type ChatMessage,
  type ToolCallInfo,
} from "@/components/chat/chat-panel";
import { useEventSource, useChatStream } from "@/hooks/use-event-source";
import { NewProjectDialog } from "@/components/editor/new-project-dialog";
import { useProjectTheme, type ProjectTheme, type ColorSchemeOverride } from "@/hooks/use-project-theme";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Panorama } from "@/components/editor/panorama";
import {
  Plus,
  FolderOpen,
  FileText,
  Loader2,
  Download,
  Share2,
  Check,
  MessageSquarePlus,
  Sun,
  Moon,
  Bot,
  Map,
  Play,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Folder,
  FileCode,
} from "lucide-react";

type CanvasMode = "experience" | "panorama";

type FileEntry = { path: string; name: string; type: "file" | "directory" };

function relativeTime(dateStr: string, t: (key: string) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("sidebar.justNow");
  if (diffMin < 60) return `${diffMin} ${t("sidebar.minutesAgo")}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ${t("sidebar.hoursAgo")}`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} ${t("sidebar.daysAgo")}`;
}

export default function Home() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("NexAgent");
  const [projectTheme, setProjectTheme] = useState<ProjectTheme | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorSchemeOverride>("auto");
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("experience");
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const { t, locale, setLocale } = useI18n();
  useProjectTheme(projectId, projectTheme, colorScheme);

  useEffect(() => {
    try {
      const s = localStorage.getItem("nexagent-color-scheme") as ColorSchemeOverride | null;
      if (s === "light" || s === "dark" || s === "auto") setColorScheme(s);
    } catch {}
  }, []);

  const cycleColorScheme = () => {
    const next: ColorSchemeOverride = colorScheme === "auto" ? "dark" : colorScheme === "dark" ? "light" : "auto";
    setColorScheme(next);
    try {
      localStorage.setItem("nexagent-color-scheme", next);
    } catch {}
  };

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; title: string; createdAt: string; updatedAt: string }[]>([]);

  const [pages, setPages] = useState<PageItem[]>([]);
  const [flows, setFlows] = useState<FlowDef[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [projectFiles, setProjectFiles] = useState<FileEntry[]>([]);
  const [sidebarConversationsOpen, setSidebarConversationsOpen] = useState(true);
  const [sidebarFilesOpen, setSidebarFilesOpen] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { send, cancel } = useChatStream();

  // Load projects on mount
  useEffect(() => {
    api.listProjects().then(setProjects).catch(console.error);
  }, []);

  // Load pages and flows when project changes
  const refreshProject = useCallback(async (pid: string) => {
    const [pageList, flowList, fileList] = await Promise.all([
      api.listPages(pid),
      api.getFlows(pid),
      api.listFiles(pid),
    ]);
    setPages(pageList);
    setFlows(flowList);
    setProjectFiles(fileList);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    refreshProject(projectId);
    api.getProject(projectId).then((p) => {
      setProjectName(p.name ?? "NexAgent");
      setProjectTheme(p.theme ?? null);
    }).catch(console.error);
  }, [projectId, refreshProject]);

  // SSE: listen for real-time updates (including streaming chat deltas)
  useEventSource(
    useCallback(
      (event: string, data: any) => {
        if (!projectId) return;

        if (event === "page.created" && data.projectId === projectId) {
          refreshProject(projectId);
          setActivePageId(data.pageId);
          setPreviewRefresh((n) => n + 1);
        }

        if (event === "page.updated" && data.projectId === projectId) {
          setPreviewRefresh((n) => n + 1);
        }

        if (event === "page.deleted" && data.projectId === projectId) {
          refreshProject(projectId);
          if (activePageId === data.pageId) setActivePageId(null);
        }

        if (event === "project.updated" && data.projectId === projectId) {
          refreshProject(projectId);
          api.getProject(projectId).then((p) => setProjectTheme(p.theme ?? null)).catch(() => {});
        }

        // ── Streaming chat deltas via EventBus ──
        if (event === "session.message" && data.sessionId === sessionId) {
          if (!data.done) {
            // Append delta to the current assistant message
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant" && last.isStreaming) {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + data.content,
                };
              }
              return updated;
            });
          } else {
            // Stream complete — finalize the message
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: data.content || last.content,
                  isStreaming: false,
                };
              }
              return updated;
            });
            setIsLoading(false);
          }
        }

        if (event === "session.error" && data.sessionId === sessionId) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: data.error,
                isStreaming: false,
                isError: true,
              };
            }
            return updated;
          });
          setIsLoading(false);
        }

        if (event === "session.tool_call" && data.sessionId === sessionId) {
          setToolCalls((prev) => {
            const existing = prev.findIndex(
              (t) => t.toolName === data.toolName && t.status === "running"
            );
            const entry: ToolCallInfo = {
              toolName: data.toolName,
              status: data.status,
              args: data.args,
              result: data.result,
            };
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = entry;
              return updated;
            }
            return [...prev, entry];
          });
        }
      },
      [projectId, sessionId, activePageId, refreshProject]
    )
  );

  const handleCreateProject = async (name: string) => {
    setShowNewProject(false);
    const project = await api.createProject(name);
    setProjects((prev) => [...prev, project]);
    setProjectId(project.id);
    setProjectName(project.name);
    const session = await api.createSession(project.id);
    setSessionId(session.id);
    setSessions([{ id: session.id, title: session.title || "New Chat", createdAt: session.createdAt, updatedAt: session.updatedAt }]);
    setMessages([]);
    setToolCalls([]);
    setPages([]);
    setFlows([]);
    setProjectFiles([]);
    setActivePageId(null);
  };

  const loadSessionMessages = async (sid: string) => {
    const msgs = await api.getMessages(sid);
    setMessages(
      msgs
        .filter((m: any) => m.role === "user" || (m.role === "assistant" && m.content))
        .map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
    );
    setToolCalls([]);
  };

  const handleSelectProject = async (id: string) => {
    setProjectId(id);
    setActivePageId(null);
    setMessages([]);
    setToolCalls([]);
    const sessionList = await api.listSessions(id);
    const mapped = sessionList.map((s: any) => ({ id: s.id, title: s.title || "Chat", createdAt: s.createdAt, updatedAt: s.updatedAt }));
    setSessions(mapped);
    if (sessionList.length > 0) {
      setSessionId(sessionList[0].id);
      await loadSessionMessages(sessionList[0].id);
    } else {
      const session = await api.createSession(id);
      setSessionId(session.id);
      setSessions([{ id: session.id, title: "New Chat", createdAt: session.createdAt, updatedAt: session.updatedAt }]);
    }
  };

  const handleSwitchSession = async (sid: string) => {
    if (sid === sessionId) return;
    setSessionId(sid);
    setMessages([]);
    setToolCalls([]);
    await loadSessionMessages(sid);
  };

  const handleNewSession = async () => {
    if (!projectId) return;
    const session = await api.createSession(projectId);
    const entry = { id: session.id, title: session.title || "New Chat", createdAt: session.createdAt, updatedAt: session.updatedAt };
    setSessions((prev) => [entry, ...prev]);
    setSessionId(session.id);
    setMessages([]);
    setToolCalls([]);
  };

  const [shareCopied, setShareCopied] = useState(false);

  const handleNavigate = useCallback((pageId: string) => {
    setActivePageId(pageId);
  }, []);

  const handleDownload = () => {
    if (!projectId) return;
    window.open(api.downloadUrl(projectId), "_blank");
  };

  const handleShare = async () => {
    if (!projectId) return;
    try {
      const { token } = await api.shareProject(projectId);
      const url = api.shareUrl(token);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error("Failed to share:", err);
    }
  };

  const handleSend = async (message: string) => {
    if (!sessionId || !projectId) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);
    setToolCalls([]);

    if (messages.length === 0) {
      const previewTitle = message.slice(0, 50);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, title: previewTitle } : s
        )
      );
    }

    try {
      await send(sessionId, message);
      // Response deltas arrive via EventSource (session.message events)
    } catch (err: any) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: err.message || "Request failed",
            isStreaming: false,
            isError: true,
          };
        }
        return updated;
      });
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (sessionId) cancel(sessionId);
  };

  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    setMessages((prev) => {
      const lastErrIdx = prev.findLastIndex((m) => m.isError);
      if (lastErrIdx >= 0) return prev.slice(0, lastErrIdx);
      return prev;
    });
    handleSend(lastUserMsg.content);
  };

  // ─── Project selection ───
  if (!projectId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="max-w-md w-full px-6">
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={cycleColorScheme}
              className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              title={colorScheme === "dark" ? t("theme.light") : colorScheme === "light" ? t("theme.dark") : t("theme.auto")}
            >
              {colorScheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setLocale("zh")}
              className={cn("px-2 py-1 rounded text-xs", locale === "zh" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]")}
            >
              中文
            </button>
            <button
              onClick={() => setLocale("en")}
              className={cn("px-2 py-1 rounded text-xs", locale === "en" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]")}
            >
              EN
            </button>
          </div>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 tracking-tight">{t("app.title")}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("app.tagline")}
            </p>
          </div>

          {projects.length > 0 && (
            <div className="space-y-2 mb-6">
              <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold px-1">
                {t("app.recentProjects")}
              </p>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProject(p.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left group"
                >
                  <FolderOpen size={18} className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors" />
                  <span className="text-sm">{p.name}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowNewProject(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            {t("app.newProject")}
          </button>

          <NewProjectDialog
            open={showNewProject}
            onClose={() => setShowNewProject(false)}
            onCreate={(name) => handleCreateProject(name)}
          />
        </div>
      </div>
    );
  }

  // ─── Workspace ───
  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Top bar */}
      {!isFullscreen && (
      <header className="h-12 flex items-center justify-between px-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExplorerOpen((o) => !o)}
            className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            title={explorerOpen ? t("workspace.hideExplorer") : t("workspace.showExplorer")}
          >
            {explorerOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <button
            onClick={() => setChatOpen((o) => !o)}
            className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            title={chatOpen ? t("workspace.hideChat") : t("workspace.showChat")}
          >
            {chatOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
          <button
            onClick={() => {
              setProjectId(null);
              setSessionId(null);
              setMessages([]);
              setPages([]);
              setFlows([]);
              setProjectFiles([]);
              setProjectTheme(null);
              setCanvasMode("experience");
            }}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            ← {t("app.projects")}
          </button>
          <div className="w-px h-4 bg-[var(--color-border)]" />
          <h1 className="text-sm font-semibold">{projectName}</h1>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {pages.length} {t("app.pages").toLowerCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          {isLoading && (
            <span className="flex items-center gap-1.5 text-[var(--color-accent)]">
              <Loader2 size={12} className="animate-spin" />
              {t("chat.agentWorking")}
            </span>
          )}
          <div className="flex items-center gap-0.5 bg-[var(--color-surface-2)] rounded-md p-0.5">
            <button
              onClick={() => setCanvasMode("experience")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                canvasMode === "experience"
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              )}
            >
              <Play size={10} />
              {t("workspace.experience")}
            </button>
            <button
              onClick={() => setCanvasMode("panorama")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                canvasMode === "panorama"
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              )}
            >
              <Map size={10} />
              {t("workspace.panorama")}
            </button>
          </div>
          <div className="w-px h-4 bg-[var(--color-border)]" />
          <button
            onClick={cycleColorScheme}
            className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            title={colorScheme === "dark" ? t("theme.light") : colorScheme === "light" ? t("theme.dark") : t("theme.auto")}
          >
            {colorScheme === "dark" ? <Sun size={14} /> : colorScheme === "light" ? <Moon size={14} /> : <Moon size={14} className="opacity-70" />}
          </button>
          <button
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            title={locale === "zh" ? "English" : "中文"}
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            <Download size={12} />
            {t("app.export")}
          </button>
          <button
            onClick={handleShare}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors",
              shareCopied
                ? "border-green-500 text-green-600"
                : "border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            )}
          >
            {shareCopied ? <Check size={12} /> : <Share2 size={12} />}
            {shareCopied ? t("app.copied") : t("app.share")}
          </button>
        </div>
      </header>
      )}

      {/* Main workspace: Sidebar | Chat | Preview */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar — collapsible sections */}
        {!isFullscreen && explorerOpen && (
        <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col overflow-y-auto">
          {/* ── Agent 对话 ── */}
          <div>
            <button
              onClick={() => setSidebarConversationsOpen((o) => !o)}
              className="w-full flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors uppercase tracking-wider"
            >
              {sidebarConversationsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <MessageCircle size={12} />
              <span className="flex-1 text-left">{t("sidebar.conversations")}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleNewSession(); }}
                className="p-0.5 rounded hover:text-[var(--color-accent)] transition-colors"
                title={t("chat.newChat")}
              >
                <Plus size={12} />
              </button>
            </button>
            {sidebarConversationsOpen && (
              <div className="pb-1">
                {sessions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-[var(--color-text-secondary)] opacity-60">
                    {t("sidebar.noConversations")}
                  </div>
                ) : (
                  sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSwitchSession(s.id)}
                      className={cn(
                        "w-full flex flex-col gap-0.5 px-3 py-2 text-left transition-colors",
                        "hover:bg-[var(--color-surface-2)]",
                        s.id === sessionId &&
                          "bg-[var(--color-surface-2)] border-l-2 border-[var(--color-accent)]"
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs truncate",
                          s.id === sessionId
                            ? "text-[var(--color-accent)] font-medium"
                            : "text-[var(--color-text)]"
                        )}
                      >
                        {s.title || t("chat.newChat")}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-secondary)]">
                        {relativeTime(s.updatedAt, t)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--color-border)]" />

          {/* ── 文件 ── */}
          <div>
            <button
              onClick={() => setSidebarFilesOpen((o) => !o)}
              className="w-full flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors uppercase tracking-wider"
            >
              {sidebarFilesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Folder size={12} />
              <span className="flex-1 text-left">{t("sidebar.files")}</span>
            </button>
            {sidebarFilesOpen && (
              <div className="pb-1">
                {projectFiles.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-[var(--color-text-secondary)] opacity-60">
                    {t("sidebar.noFiles")}
                  </div>
                ) : (
                  projectFiles.map((f) => {
                    const isHtml = f.name.endsWith(".html");
                    const pageId = isHtml ? f.name.replace(/\.html$/, "") : null;
                    const isActive = pageId && activePageId === pageId;
                    const depth = f.path.split("/").length - 1;

                    if (f.type === "directory") {
                      return (
                        <div
                          key={f.path}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                          style={{ paddingLeft: `${12 + depth * 12}px` }}
                        >
                          <FolderOpen size={12} className="shrink-0 opacity-50" />
                          <span className="truncate">{f.name}</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={f.path}
                        onClick={() => {
                          if (pageId) {
                            setActivePageId(pageId);
                            setCanvasMode("experience");
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-1.5 py-1.5 text-xs text-left transition-colors",
                          "hover:bg-[var(--color-surface-2)]",
                          isActive && "bg-[var(--color-surface-2)] text-[var(--color-accent)] border-l-2 border-[var(--color-accent)]",
                          !isHtml && "opacity-50 cursor-default"
                        )}
                        style={{ paddingLeft: `${12 + depth * 12}px` }}
                        disabled={!isHtml}
                      >
                        {isHtml ? (
                          <FileCode size={12} className={cn("shrink-0", isActive ? "text-[var(--color-accent)]" : "opacity-50")} />
                        ) : (
                          <FileText size={12} className="shrink-0 opacity-40" />
                        )}
                        <span className="truncate">{f.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>
        )}

        {/* Agent Chat panel — now between sidebar and main */}
        {!isFullscreen && chatOpen && (
        <aside className="w-96 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col">
          <div className="px-3 py-2.5 border-b border-[var(--color-border)] flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center shrink-0" title={t("app.agent")}>
              <Bot size={16} className="text-[var(--color-accent)]" />
            </div>
            <span className="flex-1 text-sm font-medium truncate">
              {sessions.find((s) => s.id === sessionId)?.title || t("chat.newChat")}
            </span>
            <button
              onClick={handleNewSession}
              className="shrink-0 p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors"
              title={t("chat.newChat")}
            >
              <MessageSquarePlus size={16} />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ChatPanel
              messages={messages}
              toolCalls={toolCalls}
              isLoading={isLoading}
              onSend={handleSend}
              onCancel={handleCancel}
              onRetry={handleRetry}
              t={t}
            />
          </div>
        </aside>
        )}

        {/* Main: Preview / Panorama */}
        <main className="flex-1 min-w-0">
          {canvasMode === "panorama" ? (
            <Panorama
              projectId={projectId}
              activePageId={activePageId}
              onSelectPage={setActivePageId}
              onOpenPage={(pageId) => {
                setActivePageId(pageId);
                setCanvasMode("experience");
              }}
            />
          ) : (
            <PreviewPanel
              projectId={projectId}
              pageId={activePageId}
              refreshKey={previewRefresh}
              onNavigate={handleNavigate}
              pages={pages}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
