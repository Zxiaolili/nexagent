"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { PageItem } from "./page-tree";

export interface FlowDef {
  from: string;
  to: string;
  trigger: string;
  /** Matches \`data-nexagent-element\` on the source page when set. */
  element?: string;
}

interface FlowGraphProps {
  pages: PageItem[];
  flows: FlowDef[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
}

export function FlowGraph({
  pages,
  flows,
  activePageId,
  onSelectPage,
}: FlowGraphProps) {
  // Build adjacency info for layout
  const { nodes, edges } = useMemo(() => {
    const pageMap = new Map(pages.map((p) => [p.id, p]));
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    pages.forEach((p) => {
      inDegree.set(p.id, 0);
      outDegree.set(p.id, 0);
    });

    const validFlows = flows.filter(
      (f) => pageMap.has(f.from) && pageMap.has(f.to)
    );

    validFlows.forEach((f) => {
      outDegree.set(f.from, (outDegree.get(f.from) || 0) + 1);
      inDegree.set(f.to, (inDegree.get(f.to) || 0) + 1);
    });

    // Simple topological-ish ordering: roots first, then by creation order
    const roots = pages.filter((p) => (inDegree.get(p.id) || 0) === 0);
    const rest = pages.filter((p) => (inDegree.get(p.id) || 0) > 0);
    const ordered = [...roots, ...rest];

    return {
      nodes: ordered,
      edges: validFlows,
    };
  }, [pages, flows]);

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-secondary)]">
        No pages yet
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 overflow-y-auto">
      {/* Page nodes */}
      <div className="flex flex-wrap gap-2">
        {nodes.map((page) => {
          const pageEdges = edges.filter(
            (e) => e.from === page.id || e.to === page.id
          );
          return (
            <button
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              className={cn(
                "relative px-3 py-2 rounded-lg border text-xs text-left transition-all min-w-[80px]",
                "hover:shadow-md",
                activePageId === page.id
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)]"
              )}
            >
              <div className="font-medium truncate">{page.name}</div>
              {pageEdges.length > 0 && (
                <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                  {pageEdges.length} flow{pageEdges.length > 1 ? "s" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Flow edges as a compact list */}
      {edges.length > 0 && (
        <div className="pt-2 border-t border-[var(--color-border)] space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
            Navigation Flows
          </div>
          {edges.map((edge, i) => {
            const fromPage = pages.find((p) => p.id === edge.from);
            const toPage = pages.find((p) => p.id === edge.to);
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"
              >
                <button
                  onClick={() => onSelectPage(edge.from)}
                  className={cn(
                    "px-1.5 py-0.5 rounded font-mono hover:text-[var(--color-accent)] transition-colors",
                    activePageId === edge.from && "text-[var(--color-accent)]"
                  )}
                >
                  {fromPage?.name || edge.from}
                </button>
                <span className="text-[var(--color-text-secondary)]">→</span>
                <button
                  onClick={() => onSelectPage(edge.to)}
                  className={cn(
                    "px-1.5 py-0.5 rounded font-mono hover:text-[var(--color-accent)] transition-colors",
                    activePageId === edge.to && "text-[var(--color-accent)]"
                  )}
                >
                  {toPage?.name || edge.to}
                </button>
                <span className="text-[10px] text-[var(--color-text-secondary)] ml-auto truncate max-w-[140px] text-right">
                  {edge.element ? (
                    <span className="font-mono text-[var(--color-accent)]">[{edge.element}]</span>
                  ) : null}
                  {edge.element ? " " : null}
                  <span className="opacity-80">{edge.trigger}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
