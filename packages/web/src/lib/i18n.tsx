"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export type Locale = "zh" | "en";

const STORAGE_KEY = "nexagent-locale";

const messages: Record<Locale, Record<string, string>> = {
  zh: {
    "app.title": "NexAgent",
    "app.tagline": "AI 原型构建器 — 用对话设计可交互原型",
    "app.recentProjects": "最近项目",
    "app.newProject": "新建项目",
    "app.projects": "项目",
    "app.pages": "页面",
    "app.flows": "流程",
    "app.agent": "Agent",
    "app.export": "导出",
    "app.share": "分享",
    "app.copied": "已复制",
    "app.version": "NexAgent v0.1",
    "chat.history": "历史对话",
    "chat.newChat": "新对话",
    "chat.placeholder": "描述你的原型需求...",
    "chat.describe": "描述你想构建的原型",
    "chat.fromTemplate": "从模板开始",
    "chat.retry": "重试",
    "chat.errorTitle": "出错了",
    "chat.agentWorking": "Agent 工作中...",
    "chat.selectPage": "选择页面以预览",
    "chat.orAskAgent": "或让 Agent 创建一个",
    "chat.back": "返回",
    "chat.refresh": "刷新",
    "chat.fullscreen": "全屏预览",
    "chat.exitFullscreen": "退出全屏 (Esc)",
    "chat.openNewTab": "新标签页打开",
    "tool.creatingPage": "创建页面",
    "tool.editingPage": "编辑页面",
    "tool.rewritingPage": "重写页面",
    "tool.readingPage": "读取页面",
    "tool.listingPages": "列出页面",
    "tool.deletingPage": "删除页面",
    "tool.updatingFlow": "更新流程",
    "tool.updatingTheme": "更新主题",
    "tool.loadingSkill": "加载技能",
    "tool.updatingRules": "更新规则",
    "hint.ecommerce": "帮我设计一个外卖APP，包含首页、商家详情、购物车",
    "hint.social": "创建一个社交应用的个人主页",
    "hint.kanban": "设计一个任务管理工具的看板页面",
    "template.ecommerce": "电商APP",
    "template.social": "社交APP",
    "template.dashboard": "管理后台",
    "theme.light": "浅色",
    "theme.dark": "深色",
    "theme.auto": "跟随项目",
    "workspace.experience": "体验",
    "workspace.panorama": "全景",
    "workspace.hideExplorer": "收起侧栏",
    "workspace.showExplorer": "展开侧栏",
    "workspace.hideChat": "收起对话",
    "workspace.showChat": "展开对话",
    "sidebar.conversations": "Agent 对话",
    "sidebar.files": "文件",
    "sidebar.noConversations": "暂无对话记录",
    "sidebar.noFiles": "暂无文件",
    "sidebar.justNow": "刚刚",
    "sidebar.minutesAgo": "分钟前",
    "sidebar.hoursAgo": "小时前",
    "sidebar.daysAgo": "天前",
  },
  en: {
    "app.title": "NexAgent",
    "app.tagline": "AI Prototype Builder — design interactive prototypes with conversation",
    "app.recentProjects": "Recent Projects",
    "app.newProject": "New Project",
    "app.projects": "Projects",
    "app.pages": "Pages",
    "app.flows": "Flows",
    "app.agent": "Agent",
    "app.export": "Export",
    "app.share": "Share",
    "app.copied": "Copied!",
    "app.version": "NexAgent v0.1",
    "chat.history": "History",
    "chat.newChat": "New chat",
    "chat.placeholder": "Describe your prototype...",
    "chat.describe": "Describe what you want to build",
    "chat.fromTemplate": "Start from template",
    "chat.retry": "Retry",
    "chat.errorTitle": "Error",
    "chat.agentWorking": "Agent working...",
    "chat.selectPage": "Select a page to preview",
    "chat.orAskAgent": "or ask the agent to create one",
    "chat.back": "Back",
    "chat.refresh": "Refresh",
    "chat.fullscreen": "Fullscreen preview",
    "chat.exitFullscreen": "Exit fullscreen (Esc)",
    "chat.openNewTab": "Open in new tab",
    "tool.creatingPage": "Creating page",
    "tool.editingPage": "Editing page",
    "tool.rewritingPage": "Rewriting page",
    "tool.readingPage": "Reading page",
    "tool.listingPages": "Listing pages",
    "tool.deletingPage": "Deleting page",
    "tool.updatingFlow": "Updating flow",
    "tool.updatingTheme": "Updating theme",
    "tool.loadingSkill": "Loading skill",
    "tool.updatingRules": "Updating rules",
    "hint.ecommerce": "Design a food delivery app: home, restaurant detail, cart",
    "hint.social": "Create a social app profile page",
    "hint.kanban": "Design a task management kanban page",
    "template.ecommerce": "E-commerce App",
    "template.social": "Social App",
    "template.dashboard": "Dashboard",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.auto": "Follow project",
    "workspace.experience": "Preview",
    "workspace.panorama": "Panorama",
    "workspace.hideExplorer": "Hide explorer",
    "workspace.showExplorer": "Show explorer",
    "workspace.hideChat": "Hide chat",
    "workspace.showChat": "Show chat",
    "sidebar.conversations": "Agent Chats",
    "sidebar.files": "Files",
    "sidebar.noConversations": "No conversations yet",
    "sidebar.noFiles": "No files yet",
    "sidebar.justNow": "just now",
    "sidebar.minutesAgo": "min ago",
    "sidebar.hoursAgo": "hr ago",
    "sidebar.daysAgo": "d ago",
  },
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored === "zh" || stored === "en") setLocaleState(stored);
    } catch {}
  }, []);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);
  const t = useCallback(
    (key: string) => messages[locale][key] ?? key,
    [locale]
  );
  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
