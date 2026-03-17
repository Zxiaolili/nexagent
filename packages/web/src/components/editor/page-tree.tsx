"use client";

import { cn } from "@/lib/cn";
import { FileText } from "lucide-react";

export interface PageItem {
  id: string;
  name: string;
  description: string;
}

interface PageTreeProps {
  pages: PageItem[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  projectName: string;
}

export function PageTree({
  pages,
  activePageId,
  onSelectPage,
}: PageTreeProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-1">
        {pages.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-[var(--color-text-secondary)]">
            <div className="text-2xl mb-2 opacity-30">📄</div>
            <p>No pages yet</p>
            <p className="mt-1 opacity-70">Ask the agent to create one!</p>
          </div>
        ) : (
          pages.map((page) => (
            <button
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                "hover:bg-[var(--color-surface-2)]",
                activePageId === page.id &&
                  "bg-[var(--color-surface-2)] text-[var(--color-accent)] border-l-2 border-[var(--color-accent)]"
              )}
            >
              <FileText
                size={14}
                className={cn(
                  "shrink-0",
                  activePageId === page.id
                    ? "text-[var(--color-accent)]"
                    : "opacity-40"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{page.name}</div>
                {page.description && (
                  <div className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                    {page.description}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
