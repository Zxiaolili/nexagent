"use client";

import { useState, useRef, useEffect } from "react";
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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
  errorCode?: string;
}

export interface ToolCallInfo {
  toolName: string;
  status: "running" | "completed" | "error";
  args?: Record<string, unknown>;
  result?: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  toolCalls: ToolCallInfo[];
  isLoading: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
  onRetry?: () => void;
  t: (key: string) => string;
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

function ToolCallCard({ tc, t }: { tc: ToolCallInfo; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const label = t(TOOL_KEYS[tc.toolName] ?? tc.toolName);
  const pageArg = (tc.args?.name || tc.args?.page_id || "") as string;

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
        {pageArg && (
          <span className="font-mono text-[var(--color-text-secondary)]">
            {pageArg}
          </span>
        )}
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
  toolCalls,
  isLoading,
  onSend,
  onCancel,
  onRetry,
  t,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
                    <p className="text-xs text-red-300/80">{msg.content}</p>
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
                {msg.content}
              </div>
            ) : (
              <div className="min-w-0 text-sm leading-relaxed break-words prose-chat">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-[var(--color-text)]">{children}</strong>,
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      if (isBlock) {
                        return (
                          <pre className="bg-[var(--color-surface-2)] rounded-lg p-3 my-2 overflow-x-auto text-xs">
                            <code>{children}</code>
                          </pre>
                        );
                      }
                      return (
                        <code className="bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded text-xs font-mono">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => <>{children}</>,
                    h1: ({ children }) => <h3 className="font-semibold text-base mt-3 mb-1">{children}</h3>,
                    h2: ({ children }) => <h3 className="font-semibold text-base mt-3 mb-1">{children}</h3>,
                    h3: ({ children }) => <h4 className="font-semibold text-sm mt-2 mb-1">{children}</h4>,
                    a: ({ href, children }) => (
                      <a href={href} className="text-[var(--color-accent)] underline" target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] ml-0.5 animate-pulse rounded-sm" />
                )}
              </div>
            )}
          </div>
        ))}

        {toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {toolCalls.map((tc, i) => (
              <ToolCallCard key={`tool-${i}`} tc={tc} t={t} />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-[var(--color-surface-2)] rounded-lg px-3 py-2",
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
