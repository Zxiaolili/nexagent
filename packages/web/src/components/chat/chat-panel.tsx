"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  Fragment,
  cloneElement,
  isValidElement,
} from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Send, Square, Wrench, ChevronDown, ChevronRight, ShoppingCart, Users, LayoutDashboard, AlertTriangle, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const TEMPLATE_CARDS = [
  {
    icon: ShoppingCart,
    titleKey: "template.ecommerce" as const,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    prompt:
      "帮我创建一个电商APP原型，包含以下页面：\n1. 首页 — 搜索栏、Banner轮播、商品分类入口、推荐商品列表\n2. 商品详情页 — 图片轮播、价格规格选择、加入购物车\n3. 购物车页 — 商品列表、数量调整、价格合计、结算按钮\n4. 个人中心 — 头像昵称、订单状态入口、功能列表\n\n请先加载 ecommerce skill 获取设计规范，然后创建所有页面并设置好页面间的导航关系。使用移动端布局，整体风格简洁现代。",
  },
  {
    icon: Users,
    titleKey: "template.social" as const,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    prompt:
      "帮我创建一个社交APP原型，包含以下页面：\n1. 信息流 — 关注/推荐Tab切换、帖子卡片列表（头像、内容、图片、点赞评论）\n2. 帖子详情 — 完整内容、评论列表、底部评论输入框\n3. 个人主页 — 封面图、头像、关注/粉丝数据、帖子列表\n4. 消息列表 — 会话列表、未读角标\n5. 聊天页 — 消息气泡、底部输入栏\n\n请先加载 social skill 获取设计规范，然后创建所有页面并设置好导航。使用移动端布局。",
  },
  {
    icon: LayoutDashboard,
    titleKey: "template.dashboard" as const,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    prompt:
      "帮我创建一个管理后台原型，包含以下页面：\n1. 登录页 — 居中登录表单\n2. 仪表盘 — 侧边栏导航 + 顶部统计卡片 + 数据图表区 + 最近活动\n3. 数据列表页 — 搜索筛选 + 数据表格 + 分页\n4. 用户管理 — 用户表格、角色状态标签、操作按钮\n5. 系统设置 — Tab分组的设置表单\n\n请先加载 dashboard skill 获取设计规范，然后创建所有页面。使用桌面端布局，侧边栏深色风格。",
  },
] as const;

export interface ToolCallInfo {
  toolName: string;
  status: "running" | "completed" | "error";
  args?: Record<string, unknown>;
  result?: string;
}

export type ChatContentBlock =
  | { type: "text"; text: string }
  | { type: "tool"; tool: ToolCallInfo };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
  errorCode?: string;
  /** Assistant only: text + tool calls in stream order (closed segments before `content`). */
  blocks?: ChatContentBlock[];
}

export interface ChatMentionOption {
  /** Full token inserted into the message, including leading @ */
  insert: string;
  label: string;
  detail: string;
  /** Page = whole screen; element = control with data-nexagent-element */
  kind: "page" | "element";
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
  onRetry?: () => void;
  t: (key: string) => string;
  /** When false, @ does not open the picker (e.g. no project open). */
  mentionsEnabled?: boolean;
  /** Pages (@pageId) and elements (@pageId:element); shown when user types @ */
  mentionOptions?: ChatMentionOption[];
}

function getActiveMention(
  value: string,
  cursorPos: number
): { start: number; query: string } | null {
  const before = value.slice(0, cursorPos);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  const fragment = before.slice(at + 1);
  if (/[\s\n]/.test(fragment)) return null;
  return { start: at, query: fragment };
}

function filterMentionOptions(
  options: ChatMentionOption[],
  query: string
): ChatMentionOption[] {
  const q = query.trim().toLowerCase();
  const base = options.filter((o) => {
    if (!q) return true;
    const hay = `${o.insert} ${o.label} ${o.detail}`.toLowerCase();
    return hay.includes(q);
  });
  const pages = base.filter((o) => o.kind === "page");
  const elements = base.filter((o) => o.kind === "element");
  return [...pages, ...elements];
}

/** Matches @-tokens the composer allows (no whitespace until end of mention). */
const AT_MENTION_RE = /@\S+/g;

const AT_MENTION_MARKDOWN_CLASS =
  "font-mono text-[var(--color-accent)] bg-[var(--color-accent)]/12 dark:bg-[var(--color-accent)]/18 rounded px-1 py-0.5 text-[0.9em]";

const AT_MENTION_USER_CLASS =
  "font-mono text-[var(--color-accent)] font-medium bg-[var(--color-surface)]/40 border border-[var(--color-accent)]/35 rounded px-1 py-px";

const AT_MENTION_ERROR_CLASS =
  "font-mono text-red-200/95 bg-red-500/20 border border-red-400/25 rounded px-1 py-px";

function splitAtMentions(text: string, className: string): ReactNode {
  const re = new RegExp(AT_MENTION_RE.source, "g");
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    parts.push(
      <span key={`at-${i++}`} className={className}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return <>{parts}</>;
}

function MarkdownCode({
  children: c,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const isBlock = className?.includes("language-");
  if (isBlock) {
    return (
      <pre className="bg-[var(--color-surface-2)] rounded-lg p-3 my-2 overflow-x-auto text-xs">
        <code>{c}</code>
      </pre>
    );
  }
  return (
    <code className="bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded text-xs font-mono">
      {c}
    </code>
  );
}

function mapAtMentionsInTree(node: ReactNode): ReactNode {
  if (node == null || typeof node === "boolean") return node;
  if (typeof node === "string") {
    return splitAtMentions(node, AT_MENTION_MARKDOWN_CLASS);
  }
  if (Array.isArray(node)) {
    return node.map((n, idx) => <Fragment key={idx}>{mapAtMentionsInTree(n)}</Fragment>);
  }
  if (isValidElement(node)) {
    if (node.type === MarkdownCode) {
      return node;
    }
    const ch = (node.props as { children?: ReactNode }).children;
    if (ch === undefined) return node;
    return cloneElement(node, { children: mapAtMentionsInTree(ch) } as never);
  }
  return node;
}

function withAtMentions(node: ReactNode): ReactNode {
  return mapAtMentionsInTree(node);
}

const TOOL_KEYS: Record<string, string> = {
  create_page: "tool.creatingPage",
  edit_page: "tool.editingPage",
  rewrite_page: "tool.rewritingPage",
  read_page: "tool.readingPage",
  list_pages: "tool.listingPages",
  delete_page: "tool.deletingPage",
  update_flow: "tool.updatingFlow",
  update_theme: "tool.updatingTheme",
  load_skill: "tool.loadingSkill",
  update_rules: "tool.updatingRules",
};

function ChatMarkdown({ children }: { children: string }) {
  if (!children) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: c }) => (
          <p className="mb-2 last:mb-0">{withAtMentions(c)}</p>
        ),
        ul: ({ children: c }) => (
          <ul className="list-disc pl-4 mb-2 space-y-1">{withAtMentions(c)}</ul>
        ),
        ol: ({ children: c }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-1">{withAtMentions(c)}</ol>
        ),
        li: ({ children: c }) => <li className="text-sm">{withAtMentions(c)}</li>,
        strong: ({ children: c }) => (
          <strong className="font-semibold text-[var(--color-text)]">{withAtMentions(c)}</strong>
        ),
        code: MarkdownCode,
        pre: ({ children: c }) => <>{withAtMentions(c)}</>,
        h1: ({ children: c }) => (
          <h3 className="font-semibold text-base mt-3 mb-1">{withAtMentions(c)}</h3>
        ),
        h2: ({ children: c }) => (
          <h3 className="font-semibold text-base mt-3 mb-1">{withAtMentions(c)}</h3>
        ),
        h3: ({ children: c }) => (
          <h4 className="font-semibold text-sm mt-2 mb-1">{withAtMentions(c)}</h4>
        ),
        blockquote: ({ children: c }) => <blockquote>{withAtMentions(c)}</blockquote>,
        table: ({ children: c }) => <table>{withAtMentions(c)}</table>,
        thead: ({ children: c }) => <thead>{withAtMentions(c)}</thead>,
        tbody: ({ children: c }) => <tbody>{withAtMentions(c)}</tbody>,
        tr: ({ children: c }) => <tr>{withAtMentions(c)}</tr>,
        th: ({ children: c }) => <th>{withAtMentions(c)}</th>,
        td: ({ children: c }) => <td>{withAtMentions(c)}</td>,
        a: ({ href, children: c }) => (
          <a
            href={href}
            className="text-[var(--color-accent)] underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {withAtMentions(c)}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function AssistantMessageBody({
  msg,
  t,
}: {
  msg: ChatMessage;
  t: (key: string) => string;
}) {
  const blocks = msg.blocks;
  const streamCursor = msg.isStreaming ? (
    <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] ml-0.5 animate-pulse rounded-sm" />
  ) : null;

  if (!blocks?.length) {
    return (
      <div className="min-w-0 text-sm leading-relaxed break-words prose-chat">
        <ChatMarkdown>{msg.content}</ChatMarkdown>
        {streamCursor}
      </div>
    );
  }

  return (
    <div className="min-w-0 text-sm leading-relaxed break-words prose-chat space-y-2">
      {blocks.map((b, idx) =>
        b.type === "text" ? (
          <ChatMarkdown key={`txt-${msg.id}-${idx}`}>{b.text}</ChatMarkdown>
        ) : (
          <ToolCallCard key={`tool-${msg.id}-${idx}`} tc={b.tool} t={t} />
        )
      )}
      {msg.content ? <ChatMarkdown key={`tail-${msg.id}`}>{msg.content}</ChatMarkdown> : null}
      {streamCursor}
    </div>
  );
}

function ToolCallCard({ tc, t }: { tc: ToolCallInfo; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const label = t(TOOL_KEYS[tc.toolName] ?? tc.toolName);
  const pageArg = (tc.args?.name || tc.args?.page_id || "") as string;
  const flowFrom = (tc.args?.from_page || "") as string;
  const flowTo = (tc.args?.to_page || "") as string;
  const flowEl = (tc.args?.element_id || "") as string;
  const flowSummary =
    tc.toolName === "update_flow" && (flowFrom || flowTo)
      ? `${flowFrom}${flowEl ? ` [${flowEl}]` : ""} → ${flowTo}`
      : "";

  return (
    <div className="rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--color-border)]/30 transition-colors"
      >
        <Wrench
          size={12}
          className={cn(
            tc.status === "running" && "animate-spin text-yellow-400",
            tc.status === "completed" && "text-green-400",
            tc.status === "error" && "text-red-400"
          )}
        />
        <span className="text-[var(--color-text)]">{label}</span>
        {flowSummary ? (
          <span className="font-mono text-[var(--color-text-secondary)] truncate max-w-[200px]">
            {flowSummary}
          </span>
        ) : pageArg ? (
          <span className="font-mono text-[var(--color-text-secondary)]">
            {pageArg}
          </span>
        ) : null}
        <span className="ml-auto">
          {tc.status === "running" && (
            <span className="text-yellow-400">...</span>
          )}
          {tc.status === "completed" && (
            <span className="text-green-400">✓</span>
          )}
          {tc.status === "error" && (
            <span className="text-red-400">✗</span>
          )}
        </span>
        {tc.result && (
          expanded
            ? <ChevronDown size={12} className="text-[var(--color-text-secondary)]" />
            : <ChevronRight size={12} className="text-[var(--color-text-secondary)]" />
        )}
      </button>
      {expanded && tc.result && (
        <div className="px-3 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
          {tc.result}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({
  messages,
  isLoading,
  onSend,
  onCancel,
  onRetry,
  t,
  mentionsEnabled = true,
  mentionOptions = [],
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [caret, setCaret] = useState(0);
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionState = useMemo(
    () => getActiveMention(input, caret),
    [input, caret]
  );

  const mentionList = useMemo(() => {
    if (!mentionState || !mentionsEnabled) return [];
    return filterMentionOptions(mentionOptions, mentionState.query);
  }, [mentionState, mentionOptions, mentionsEnabled]);

  const mentionOpen = Boolean(mentionState && mentionsEnabled);

  const mentionPageRows = useMemo(
    () => mentionList.filter((o) => o.kind === "page"),
    [mentionList]
  );
  const mentionElementRows = useMemo(
    () => mentionList.filter((o) => o.kind === "element"),
    [mentionList]
  );

  useEffect(() => {
    if (mentionOpen) setMentionHighlight(0);
  }, [mentionState?.query, mentionOpen]);

  useEffect(() => {
    if (mentionHighlight >= mentionList.length) {
      setMentionHighlight(mentionList.length > 0 ? mentionList.length - 1 : 0);
    }
  }, [mentionHighlight, mentionList.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const applyMention = useCallback(
    (opt: ChatMentionOption) => {
      const el = textareaRef.current;
      if (!el || !mentionState) return;
      const cursor = caret;
      const before = input.slice(0, mentionState.start);
      const after = input.slice(cursor);
      const next = `${before}${opt.insert} ${after}`;
      setInput(next);
      const pos = before.length + opt.insert.length + 1;
      setCaret(pos);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [input, mentionState, caret]
  );

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
    setCaret(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (mentionList.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionHighlight((i) => (i + 1) % mentionList.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionHighlight((i) => (i - 1 + mentionList.length) % mentionList.length);
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          applyMention(mentionList[mentionHighlight]!);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        const el = textareaRef.current;
        if (el && mentionState) {
          const after = input.slice(caret);
          const nextStart = mentionState.start;
          setInput(`${input.slice(0, nextStart)}${after}`);
          setCaret(nextStart);
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(nextStart, nextStart);
          });
        }
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hints = [t("hint.ecommerce"), t("hint.social"), t("hint.kanban")];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">
            <div className="text-3xl mb-3 opacity-30">💬</div>
            <p className="text-sm">{t("chat.describe")}</p>
            <div className="mt-4 space-y-2">
              {hints.map((hint, i) => (
                <button
                  key={i}
                  onClick={() => onSend(hint)}
                  className="block w-full text-left px-3 py-2 rounded-lg text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">{t("chat.fromTemplate")}</p>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATE_CARDS.map((tpl) => (
                  <button
                    key={tpl.titleKey}
                    onClick={() => onSend(tpl.prompt)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] transition-colors group"
                  >
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", tpl.bg)}>
                      <tpl.icon size={20} className={tpl.color} />
                    </div>
                    <span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                      {t(tpl.titleKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : ""}>
            {msg.isError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 max-w-[85%]">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 text-red-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-red-300 font-medium mb-1">{t("chat.errorTitle")}</p>
                    <p className="text-xs text-red-300/80 whitespace-pre-wrap break-words">
                      {splitAtMentions(msg.content, AT_MENTION_ERROR_CLASS)}
                    </p>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                      >
                        <RotateCcw size={12} />
                        {t("chat.retry")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : msg.role === "user" ? (
              <div className="max-w-[85%] rounded-xl px-3 py-2.5 bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {splitAtMentions(msg.content, AT_MENTION_USER_CLASS)}
              </div>
            ) : (
              <AssistantMessageBody msg={msg} t={t} />
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        <div className="flex items-end gap-2">
          <div className="relative flex-1 min-w-0">
            {mentionOpen ? (
              <div className="absolute bottom-full left-0 right-0 z-30 mb-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg max-h-52 overflow-y-auto">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                  {t("chat.mentionHeading")}
                </div>
                {mentionOptions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    {t("chat.mentionNoPages")}
                  </div>
                ) : mentionList.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    {t("chat.mentionEmpty")}
                  </div>
                ) : (
                  <>
                    {mentionPageRows.length > 0 ? (
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
                        {t("chat.mentionPages")}
                      </div>
                    ) : null}
                    {mentionPageRows.map((opt) => {
                      const idx = mentionList.indexOf(opt);
                      return (
                        <button
                          key={`p-${opt.insert}`}
                          type="button"
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            applyMention(opt);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs border-b border-[var(--color-border)] transition-colors",
                            idx === mentionHighlight
                              ? "bg-[var(--color-accent)]/15 text-[var(--color-text)]"
                              : "hover:bg-[var(--color-surface-2)] text-[var(--color-text)]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase bg-violet-500/15 text-violet-600 dark:text-violet-300">
                              {t("chat.mentionKindPage")}
                            </span>
                            <span className="font-mono text-[11px] text-[var(--color-accent)] min-w-0 truncate">
                              {opt.insert}
                            </span>
                          </div>
                          <div className="text-[var(--color-text-secondary)] mt-0.5 truncate pl-0">{opt.label}</div>
                        </button>
                      );
                    })}
                    {mentionElementRows.length > 0 ? (
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
                        {t("chat.mentionElements")}
                      </div>
                    ) : null}
                    {mentionElementRows.map((opt) => {
                      const idx = mentionList.indexOf(opt);
                      return (
                        <button
                          key={`e-${opt.insert}`}
                          type="button"
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            applyMention(opt);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs border-b border-[var(--color-border)] last:border-b-0 transition-colors",
                            idx === mentionHighlight
                              ? "bg-[var(--color-accent)]/15 text-[var(--color-text)]"
                              : "hover:bg-[var(--color-surface-2)] text-[var(--color-text)]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase bg-sky-500/15 text-sky-700 dark:text-sky-300">
                              {t("chat.mentionKindElement")}
                            </span>
                            <span className="font-mono text-[11px] text-[var(--color-accent)] min-w-0 truncate">
                              {opt.insert}
                            </span>
                          </div>
                          <div className="text-[var(--color-text-secondary)] mt-0.5 truncate">{opt.detail}</div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            ) : null}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setCaret(e.target.selectionStart);
              }}
              onKeyDown={handleKeyDown}
              onClick={(e) => setCaret(e.currentTarget.selectionStart)}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
              onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
              placeholder={t("chat.placeholder")}
              rows={1}
              className={cn(
                "w-full resize-none bg-[var(--color-surface-2)] rounded-lg px-3 py-2",
                "text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]",
                "border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none",
                "max-h-32 transition-colors"
              )}
              style={{ height: "auto", minHeight: "38px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 128) + "px";
              }}
            />
          </div>
          {isLoading ? (
            <button
              onClick={onCancel}
              className="shrink-0 p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Stop"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className={cn(
                "shrink-0 p-2 rounded-lg transition-colors",
                input.trim()
                  ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"
              )}
              title="Send"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
