"use client";

import { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/lib/store/workspace";
import { FileText, Plus, Home, FolderTree, Layers } from "lucide-react";
import { FileTree } from "./file-tree";

interface PageInfo {
  pageId: string;
  title: string;
  isEntry: boolean;
}

interface ExplorerProps {
  projectId: string;
}

export function Explorer({ projectId }: ExplorerProps) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const selectedPageId = useWorkspaceStore((s) => s.selectedPageId);
  const setSelectedPageId = useWorkspaceStore((s) => s.setSelectedPageId);
  const sidebarTab = useWorkspaceStore((s) => s.sidebarTab);
  const setSidebarTab = useWorkspaceStore((s) => s.setSidebarTab);

  useEffect(() => {
    fetchPages();
  }, [projectId]);

  async function fetchPages() {
    try {
      const res = await fetch(`/api/prototype?projectId=${projectId}&action=list`);
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages || []);
        if (data.pages?.length > 0 && !selectedPageId) {
          const entry = data.pages.find((p: PageInfo) => p.isEntry) || data.pages[0];
          setSelectedPageId(entry.pageId);
        }
      }
    } catch {
      // API not implemented yet
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex border-b shrink-0">
        <button
          onClick={() => setSidebarTab("files")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
            sidebarTab === "files"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderTree className="h-3.5 w-3.5" />
          文件
        </button>
        <button
          onClick={() => setSidebarTab("pages")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
            sidebarTab === "pages"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          页面
        </button>
      </div>

      {/* Tab content */}
      {sidebarTab === "files" ? (
        <FileTree projectId={projectId} />
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-3 py-2 border-b flex items-center justify-between shrink-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              页面
            </span>
            <button
              className="p-1 rounded hover:bg-accent text-muted-foreground"
              title="新建页面（通过对话创建）"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {pages.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-muted-foreground">
                  在对话中描述你的产品，
                  <br />
                  Agent 会自动创建页面
                </p>
              </div>
            ) : (
              pages.map((page) => (
                <button
                  key={page.pageId}
                  onClick={() => setSelectedPageId(page.pageId)}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm transition-colors ${
                    selectedPageId === page.pageId
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  {page.isEntry ? (
                    <Home className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{page.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
