"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import {
  MentionInput,
  type MentionInputHandle,
  type MentionRef,
} from "./mention-input";
import { useWorkspaceStore } from "@/lib/store/workspace";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mentions?: MentionRef[];
}

interface ChatProps {
  projectId: string;
}

export function Chat({ projectId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentMentions, setCurrentMentions] = useState<MentionRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mentionInputRef = useRef<MentionInputHandle>(null);

  const selectedPageId = useWorkspaceStore((s) => s.selectedPageId);
  const selectedElementId = useWorkspaceStore((s) => s.selectedElementId);
  const setSelectedElementId = useWorkspaceStore((s) => s.setSelectedElementId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When an element is selected in the preview, auto-insert a mention
  useEffect(() => {
    if (!selectedElementId) return;

    function handleElementMessage(e: MessageEvent) {
      if (
        e.data?.type === "element-selected" &&
        e.data.elementName &&
        selectedPageId
      ) {
        mentionInputRef.current?.insertMention({
          pageId: selectedPageId,
          pageName: selectedPageId,
          elementId: e.data.elementId,
          elementName: e.data.elementName,
        });
      }
    }
    window.addEventListener("message", handleElementMessage);
    return () => window.removeEventListener("message", handleElementMessage);
  }, [selectedPageId, selectedElementId]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      mentions: currentMentions.length > 0 ? [...currentMentions] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setCurrentMentions([]);
    mentionInputRef.current?.clear();
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: userMessage.content,
          mentions: userMessage.mentions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.message || "收到，正在处理...",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "连接失败，请检查服务是否正常运行。",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, currentMentions, projectId]);

  function renderMentionChips(mentions?: MentionRef[]) {
    if (!mentions || mentions.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {mentions.map((m, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-medium"
          >
            @{m.elementName ? `${m.pageName}/${m.elementName}` : m.pageName}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-2.5 border-b shrink-0">
        <h2 className="text-sm font-medium">设计对话</h2>
        <p className="text-xs text-muted-foreground">
          描述你的产品想法，输入 @ 引用页面和元素
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground mb-4">
              试试这样说：
            </p>
            <div className="space-y-2">
              {[
                "帮我设计一个电商App，包含首页、商品详情、购物车",
                "做一个简洁的登录注册页面，支持手机号和微信登录",
                "设计一个项目管理工具的仪表盘",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left text-xs px-3 py-2 rounded-md border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.content}
              {msg.role === "user" && renderMentionChips(msg.mentions)}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-3 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <MentionInput
              ref={mentionInputRef}
              projectId={projectId}
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              onMentionsChange={setCurrentMentions}
              placeholder="描述你想要的页面或修改... 输入 @ 引用"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="shrink-0 rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
