"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { NextLogo } from "@/components/brand/next-logo";
import {
  VerticalPanelResizeHandle,
  TrackedHorizontalResizeHandle,
} from "@/components/workspace/panel-resize-handle";
import {
  Plus,
  FolderOpen,
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
  ChevronDown,
  ChevronRight,
  X,
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

function clampLayout(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
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
  const [explorerWidth, setExplorerWidth] = useState(224);
  const [chatWidth, setChatWidth] = useState(384);
  const [sidebarConvHeightPx, setSidebarConvHeightPx] = useState(200);
  const sidebarStackRef = useRef<HTMLDivElement>(null);
  const sidebarTopPaneRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  const { send, cancel } = useChatStream();

  useEffect(() => {
    try {
      const ew = Number.parseInt(localStorage.getItem("nexagent-explorer-w") || "", 10);
      if (!Number.isNaN(ew)) setExplorerWidth(clampLayout(ew, 176, 380));
      const cw = Number.parseInt(localStorage.getItem("nexagent-chat-w") || "", 10);
      if (!Number.isNaN(cw)) setChatWidth(clampLayout(cw, 280, 640));
      const sh = Number.parseInt(localStorage.getItem("nexagent-sidebar-conv-px") || "", 10);
      if (!Number.isNaN(sh)) setSidebarConvHeightPx(clampLayout(sh, 72, 2000));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("nexagent-explorer-w", String(explorerWidth));
    } catch {
      /* ignore */
    }
  }, [explorerWidth]);

  useEffect(() => {
    try {
      localStorage.setItem("nexagent-chat-w", String(chatWidth));
    } catch {
      /* ignore */
    }
  }, [chatWidth]);

  useEffect(() => {
    try {
      localStorage.setItem("nexagent-sidebar-conv-px", String(sidebarConvHeightPx));
    } catch {
      /* ignore */
    }
  }, [sidebarConvHeightPx]);

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
    setChatOpen(true);
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
  const bothSidebarListsOpen = sidebarConversationsOpen && sidebarFilesOpen;
  const sidebarBlock1Flex = sidebarConversationsOpen ? "1 1 0%" : "0 0 auto";
  const sidebarBlock2Flex = sidebarFilesOpen ? "1 1 0%" : "0 0 auto";

  const canvasModeSwitcher = (
    <>
      <button
        type="button"
        onClick={() => setCanvasMode("experience")}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
          canvasMode === "experience"
            ? "bg-[var(--color-accent)] text-white"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        )}
      >
        <Play size={12} />
        {t("workspace.experience")}
      </button>
      <button
        type="button"
        onClick={() => setCanvasMode("panorama")}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
          canvasMode === "panorama"
            ? "bg-[var(--color-accent)] text-white"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        )}
      >
        <Map size={12} />
        {t("workspace.panorama")}
      </button>
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
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
          <button
            type="button"
            onClick={cycleColorScheme}
            className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            title={colorScheme === "dark" ? t("theme.light") : colorScheme === "light" ? t("theme.dark") : t("theme.auto")}
          >
            {colorScheme === "dark" ? <Sun size={14} /> : colorScheme === "light" ? <Moon size={14} /> : <Moon size={14} className="opacity-70" />}
          </button>
          <button
            type="button"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            title={locale === "zh" ? "English" : "中文"}
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>

      {/* Main workspace: Sidebar | Chat | Preview */}
      <div className="flex-1 flex min-h-0">
        {!explorerOpen && (
          <div className="w-9 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center justify-end pb-3 pt-2">
            <button
              type="button"
              onClick={() => setExplorerOpen(true)}
              className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              title={t("workspace.showExplorer")}
            >
              <PanelLeftOpen size={18} />
            </button>
          </div>
        )}

        {explorerOpen && (
          <>
            <aside
              className="shrink-0 bg-[var(--color-surface)] flex flex-col h-full min-h-0 overflow-hidden"
              style={{ width: explorerWidth }}
            >
              <div
                ref={sidebarStackRef}
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
              >
              <div
                ref={sidebarTopPaneRef}
                className="flex flex-col min-h-0 overflow-hidden"
                style={
                  bothSidebarListsOpen
                    ? {
                        flex: "none",
                        height: sidebarConvHeightPx,
                        minHeight: 72,
                      }
                    : {
                        flex: sidebarBlock1Flex,
                        minHeight: sidebarConversationsOpen ? 0 : undefined,
                      }
                }
              >
                <div className="shrink-0 flex items-stretch min-w-0">
                  <button
                    type="button"
                    onClick={() => setSidebarConversationsOpen((o) => !o)}
                    className="flex-1 flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors uppercase tracking-wider text-left min-w-0"
                  >
                    {sidebarConversationsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span className="truncate">{t("sidebar.conversations")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleNewSession()}
                    className="shrink-0 self-center mr-2 p-1 rounded-md hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors"
                    title={t("chat.newChat")}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {sidebarConversationsOpen && (
                  <div className="flex-1 min-h-0 overflow-y-auto pb-1">
                    {sessions.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-[var(--color-text-secondary)] opacity-60">
                        {t("sidebar.noConversations")}
                      </div>
                    ) : (
                      sessions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setChatOpen(true);
                            void handleSwitchSession(s.id);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                            "hover:bg-[var(--color-surface-2)]",
                            s.id === sessionId &&
                              "bg-[var(--color-surface-2)] border-l-2 border-[var(--color-accent)]"
                          )}
                        >
                          <span
                            className={cn(
                              "text-xs truncate min-w-0 flex-1",
                              s.id === sessionId
                                ? "text-[var(--color-accent)] font-medium"
                                : "text-[var(--color-text)]"
                            )}
                          >
                            {s.title || t("chat.newChat")}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-secondary)] shrink-0 tabular-nums">
                            {relativeTime(s.updatedAt, t)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {bothSidebarListsOpen && (
                <TrackedHorizontalResizeHandle
                  title={t("workspace.resizeSidebarSections")}
                  stackRef={sidebarStackRef}
                  minTopPx={72}
                  minBottomPx={112}
                  getTopHeight={() =>
                    sidebarTopPaneRef.current?.getBoundingClientRect().height ??
                    sidebarConvHeightPx
                  }
                  onTopHeightChange={setSidebarConvHeightPx}
                />
              )}

              <div
                className={cn(
                  "flex flex-col min-h-0",
                  !bothSidebarListsOpen && "border-t border-[var(--color-border)]"
                )}
                style={{
                  flex: bothSidebarListsOpen ? "1 1 0%" : sidebarBlock2Flex,
                  minHeight: bothSidebarListsOpen || sidebarFilesOpen ? 0 : undefined,
                }}
              >
                <div className="shrink-0 flex items-stretch gap-0.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSidebarFilesOpen((o) => !o)}
                    className="flex-1 min-w-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors uppercase tracking-wider text-left"
                  >
                    {sidebarFilesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span className="truncate">{t("sidebar.files")}</span>
                  </button>
                  <div className="flex items-center shrink-0 pr-1.5 gap-0.5">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors"
                      title={t("app.export")}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare()}
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        shareCopied
                          ? "text-green-600 bg-green-500/10"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
                      )}
                      title={shareCopied ? t("app.copied") : t("app.share")}
                    >
                      {shareCopied ? <Check size={15} /> : <Share2 size={15} />}
                    </button>
                  </div>
                </div>
                {sidebarFilesOpen && (
                  <div className="flex-1 min-h-0 overflow-y-auto pb-1">
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
                              className="flex items-center px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                              style={{ paddingLeft: `${12 + depth * 12}px` }}
                            >
                              <span className="truncate">{f.name}</span>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={f.path}
                            type="button"
                            onClick={() => {
                              if (pageId) {
                                setActivePageId(pageId);
                                setCanvasMode("experience");
                              }
                            }}
                            className={cn(
                              "w-full flex items-center py-1.5 text-xs text-left transition-colors",
                              "hover:bg-[var(--color-surface-2)]",
                              isActive &&
                                "bg-[var(--color-surface-2)] text-[var(--color-accent)] border-l-2 border-[var(--color-accent)]",
                              !isHtml && "opacity-50 cursor-default"
                            )}
                            style={{ paddingLeft: `${12 + depth * 12}px` }}
                            disabled={!isHtml}
                          >
                            <span className="truncate">{f.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              </div>

              <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 transition-colors"
                  title={projectName}
                  aria-label={projectName}
                >
                  <NextLogo className="w-[15px] h-[15px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setExplorerOpen(false)}
                  className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors shrink-0"
                  title={t("workspace.hideExplorer")}
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>
            </aside>
            <VerticalPanelResizeHandle
              title={t("workspace.resizeColumns")}
              onResizeDelta={(dx) => {
                setExplorerWidth((w) => clampLayout(w + dx, 176, 380));
              }}
            />
          </>
        )}

        {chatOpen && (
          <>
            <aside
              className="shrink-0 bg-[var(--color-surface)] flex flex-col min-h-0 overflow-hidden"
              style={{ width: chatWidth }}
            >
              <div className="px-3 py-2.5 border-b border-[var(--color-border)] flex items-center gap-2 shrink-0">
                <div
                  className="w-7 h-7 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center shrink-0"
                  title={t("app.agent")}
                >
                  <Bot size={16} className="text-[var(--color-accent)]" />
                </div>
                <span className="flex-1 text-sm font-medium truncate min-w-0">
                  {sessions.find((s) => s.id === sessionId)?.title || t("chat.newChat")}
                </span>
                <button
                  type="button"
                  onClick={() => void handleNewSession()}
                  className="shrink-0 p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors"
                  title={t("chat.newChat")}
                >
                  <MessageSquarePlus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="shrink-0 p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                  title={t("workspace.closeAgent")}
                >
                  <X size={16} />
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
            <VerticalPanelResizeHandle
              title={t("workspace.resizeColumns")}
              onResizeDelta={(dx) => {
                setChatWidth((w) => clampLayout(w + dx, 280, 640));
              }}
            />
          </>
        )}

        {/* Main: canvas toolbar + Preview / Panorama */}
        <main className="flex flex-col flex-1 min-w-0 min-h-0">
          {canvasMode === "panorama" && (
            <div className="shrink-0 flex items-center justify-end gap-0.5 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {canvasModeSwitcher}
            </div>
          )}
          <div className="flex-1 min-h-0 min-w-0">
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
                trailingToolbar={canvasModeSwitcher}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
