"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";

interface PageInfo {
  id: string;
  name: string;
  description: string;
  content?: string;
}

interface FlowInfo {
  from: string;
  to: string;
  trigger: string;
  element?: string;
}

interface PanoramaProps {
  projectId: string;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onOpenPage: (pageId: string) => void;
  /** Bumps when project pages change (SSE); triggers refetch. */
  refreshKey?: number;
}

const EDGE_COLOR = { idle: "#94a3b8", hover: "#2563eb" };
const EDGE_LABEL = { idle: "#64748b", hover: "#1e40af" };

function PageNode({ data, selected }: NodeProps) {
  const nodeData = data as {
    title: string;
    pageId: string;
    htmlContent: string;
    onOpenPage: (pageId: string) => void;
    platform: string;
  };

  const isMobile = nodeData.platform !== "desktop";
  const nodeW = isMobile ? 200 : 300;
  const nodeH = isMobile ? 340 : 240;

  return (
    <div
      className={`rounded-xl bg-[var(--color-surface)] shadow-md transition-all cursor-pointer ${
        selected
          ? "shadow-lg ring-2 ring-[var(--color-accent)]/30"
          : "hover:shadow-lg"
      }`}
      style={{ width: nodeW, height: nodeH }}
      onDoubleClick={() => nodeData.onOpenPage(nodeData.pageId)}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-[var(--color-accent)]" />

      <div className="px-3 py-1.5 flex items-center gap-1.5">
        <span className="text-xs font-medium truncate text-[var(--color-text)]">{nodeData.title}</span>
      </div>

      <div className="flex items-start justify-center px-3 pb-2">
        {isMobile ? (
          <MobileFrame htmlContent={nodeData.htmlContent} title={nodeData.title} />
        ) : (
          <DesktopFrame htmlContent={nodeData.htmlContent} title={nodeData.title} />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-[var(--color-accent)]" />
    </div>
  );
}

function MobileFrame({ htmlContent, title }: { htmlContent: string; title: string }) {
  return (
    <div
      className="relative overflow-hidden bg-[var(--color-surface-2)]"
      style={{
        width: 170,
        height: 293,
        borderRadius: "1.5rem",
        border: "4px solid var(--color-border)",
      }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 bg-[var(--color-border)] rounded-b-lg z-10"
        style={{ width: 56, height: 5 }}
      />
      <div
        style={{
          width: 375,
          height: 812,
          transform: `scale(${162 / 375})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <iframe
          srcDoc={buildThumbnailHtml(htmlContent)}
          className="w-full h-full border-0"
          sandbox="allow-scripts"
          tabIndex={-1}
          title={`Thumbnail: ${title}`}
        />
      </div>
      <div
        className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-border)]"
        style={{ width: 48, height: 4 }}
      />
    </div>
  );
}

function DesktopFrame({ htmlContent, title }: { htmlContent: string; title: string }) {
  return (
    <div
      className="overflow-hidden bg-[var(--color-surface-2)]"
      style={{
        width: 278,
        height: 195,
        borderRadius: "0.5rem",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="flex items-center gap-1.5 px-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{ height: 20 }}
      >
        <div className="w-[6px] h-[6px] rounded-full bg-[#ff5f57]" />
        <div className="w-[6px] h-[6px] rounded-full bg-[#febc2e]" />
        <div className="w-[6px] h-[6px] rounded-full bg-[#28c840]" />
        <div className="flex-1 mx-2 h-3 bg-[var(--color-surface-2)] rounded-sm" />
      </div>
      <div
        style={{
          width: 1024,
          height: 768,
          transform: `scale(${276 / 1024})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <iframe
          srcDoc={buildThumbnailHtml(htmlContent)}
          className="w-full h-full border-0"
          sandbox="allow-scripts"
          tabIndex={-1}
          title={`Thumbnail: ${title}`}
        />
      </div>
    </div>
  );
}

const DISABLE_INTERACTION_STYLE = `<style data-panorama>*{pointer-events:none!important;user-select:none!important}body{overflow:hidden!important}</style>`;

function buildThumbnailHtml(htmlContent: string): string {
  if (!htmlContent) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#ccc;font-size:14px;">Empty</div></body></html>`;
  }

  if (htmlContent.includes("<head")) {
    return htmlContent.replace("</head>", DISABLE_INTERACTION_STYLE + "</head>");
  }

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${DISABLE_INTERACTION_STYLE}
</head><body>${htmlContent}</body></html>`;
}

function isAutoFlow(trigger: string): boolean {
  return /自动|auto|redirect|定时|timer|加载|onload|splash|启动|倒计时|timeout|页面加载/i.test(trigger);
}

const nodeTypes = { pageNode: PageNode };

export function Panorama({
  projectId,
  activePageId,
  onSelectPage,
  onOpenPage,
  refreshKey = 0,
}: PanoramaProps) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [flows, setFlows] = useState<FlowInfo[]>([]);
  const [platform, setPlatform] = useState<string>("mobile");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pageList, project] = await Promise.all([
          api.listPages(projectId),
          api.getProject(projectId),
        ]);

        const pagesWithContent = await Promise.all(
          pageList.map(async (p) => {
            try {
              const page = await api.getPage(projectId, p.id);
              return { ...p, content: page.content || "" };
            } catch {
              return { ...p, content: "" };
            }
          })
        );
        if (!cancelled) {
          setPages(pagesWithContent);
          setFlows(project.flows || []);
          setPlatform(project.platform || "mobile");
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  const initialNodes = useMemo(() => {
    const isMobile = platform !== "desktop";
    const nodeW = isMobile ? 200 : 300;
    const nodeH = isMobile ? 340 : 240;
    const cols = isMobile ? 3 : 2;
    const xGap = nodeW + 80;
    const yGap = nodeH + 60;

    return pages.map((page, i) => ({
      id: page.id,
      type: "pageNode",
      position: {
        x: (i % cols) * xGap,
        y: Math.floor(i / cols) * yGap,
      },
      data: {
        title: page.name,
        pageId: page.id,
        htmlContent: page.content || "",
        onOpenPage,
        platform,
      },
      selected: page.id === activePageId,
    }));
  }, [pages, activePageId, onOpenPage, platform]);

  const initialEdges = useMemo(() => {
    return flows.map((nav, i) => {
      const auto = isAutoFlow(nav.trigger);
      const el = nav.element?.trim();
      const head = auto ? "⚡ " : "👆 ";
      const label = el ? `${head}[${el}] · ${nav.trigger}` : `${head}${nav.trigger}`;
      const edgeKey = `${nav.from}|${nav.to}|${el ?? ""}|${i}`;
      return {
        id: `nav-${edgeKey}`,
        source: nav.from,
        target: nav.to,
        label,
        type: "smoothstep",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR.idle },
        style: {
          stroke: EDGE_COLOR.idle,
          strokeWidth: 2,
          strokeDasharray: auto ? "6 4" : undefined,
        },
        labelStyle: {
          fontSize: 11,
          fontWeight: 600,
          fill: EDGE_LABEL.idle,
        },
        labelBgStyle: {
          fill: "var(--color-surface, #fff)",
          fillOpacity: 0.95,
        },
        labelBgPadding: [8, 6] as [number, number],
        labelBgBorderRadius: 6,
      };
    });
  }, [flows]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectPage(node.id);
    },
    [onSelectPage]
  );

  const onEdgeMouseEnter = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edge.id
            ? {
                ...e,
                style: { ...e.style, stroke: EDGE_COLOR.hover, strokeWidth: 3 },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: EDGE_COLOR.hover,
                },
                labelStyle: {
                  fontSize: 11,
                  fontWeight: 500,
                  ...((e.labelStyle ?? {}) as Record<string, unknown>),
                  fill: EDGE_LABEL.hover,
                },
              }
            : e
        )
      );
    },
    [setEdges]
  );

  const onEdgeMouseLeave = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edge.id
            ? {
                ...e,
                style: { ...e.style, stroke: EDGE_COLOR.idle, strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR.idle },
                labelStyle: {
                  fontSize: 11,
                  fontWeight: 500,
                  ...((e.labelStyle ?? {}) as Record<string, unknown>),
                  fill: EDGE_LABEL.idle,
                },
              }
            : e
        )
      );
    },
    [setEdges]
  );

  if (pages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-2 opacity-30">🗺️</div>
          <p className="text-sm text-[var(--color-text-secondary)]">No pages yet</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 opacity-70">
            Ask the agent to create pages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          style={{ height: 80, width: 120 }}
        />
      </ReactFlow>
    </div>
  );
}
