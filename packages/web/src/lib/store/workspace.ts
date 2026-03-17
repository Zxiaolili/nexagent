"use client";

import { create } from "zustand";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface ElementInfo {
  id: string;
  name: string;
  selector: string;
  type: "button" | "input" | "text" | "image" | "container" | "list" | "other";
}

export interface WorkspaceState {
  projectId: string | null;
  selectedPageId: string | null;
  previewMode: "experience" | "panorama";
  chatOpen: boolean;
  explorerOpen: boolean;
  sidebarTab: "files" | "pages";
  selectedElementId: string | null;
  navigationHistory: string[];
  fileTree: FileNode[] | null;
  elements: Record<string, ElementInfo[]>;

  setProjectId: (id: string | null) => void;
  setSelectedPageId: (id: string | null) => void;
  setPreviewMode: (mode: "experience" | "panorama") => void;
  toggleChat: () => void;
  toggleExplorer: () => void;
  setSidebarTab: (tab: "files" | "pages") => void;
  setSelectedElementId: (id: string | null) => void;
  pushNavigation: (pageId: string) => void;
  popNavigation: () => string | undefined;
  clearNavigation: () => void;
  setFileTree: (tree: FileNode[]) => void;
  setElements: (pageId: string, elements: ElementInfo[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projectId: null,
  selectedPageId: null,
  previewMode: "experience",
  chatOpen: true,
  explorerOpen: true,
  sidebarTab: "pages",
  selectedElementId: null,
  navigationHistory: [],
  fileTree: null,
  elements: {},

  setProjectId: (id) => set({ projectId: id }),
  setSelectedPageId: (id) => set({ selectedPageId: id, selectedElementId: null }),
  setPreviewMode: (mode) => set({ previewMode: mode }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  toggleExplorer: () => set((s) => ({ explorerOpen: !s.explorerOpen })),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  pushNavigation: (pageId) =>
    set((s) => ({ navigationHistory: [...s.navigationHistory, pageId] })),
  popNavigation: () => {
    const history = get().navigationHistory;
    if (history.length === 0) return undefined;
    const last = history[history.length - 1];
    set({ navigationHistory: history.slice(0, -1) });
    return last;
  },
  clearNavigation: () => set({ navigationHistory: [] }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setElements: (pageId, elements) =>
    set((s) => ({ elements: { ...s.elements, [pageId]: elements } })),
}));
