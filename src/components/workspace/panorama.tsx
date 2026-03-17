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
import { useWorkspaceStore } from "@/lib/store/workspace";

interface PageInfo {
  pageId: string;
  title: string;
  isEntry: boolean;
  htmlContent?: string;
}

interface NavigationInfo {
  fromPageId: string;
  toPageId: string;
  trigger: string;
  animation: string;
}

interface PanoramaProps {
  projectId: string;
}

function PageNode({ data, selected }: NodeProps) {
  const nodeData = data as {
    title: string;
    pageId: string;
    isEntry: boolean;
    htmlContent: string;
    onSelectPage: (pageId: string) => void;
  };

  return (
    <div
      className={`rounded-lg border-2 bg-white shadow-md transition-all cursor-pointer ${
        selected
          ? "border-primary shadow-lg ring-2 ring-primary/20"
          : "border-border hover:border-primary/50 hover:shadow-lg"
      }`}
      style={{ width: 200, height: 280 }}
      onDoubleClick={() => nodeData.onSelectPage(nodeData.pageId)}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-primary" />

      {/* Page title bar */}
      <div className="px-3 py-1.5 border-b bg-muted/30 rounded-t-lg flex items-center gap-1.5">
        {nodeData.isEntry && (
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="入口页" />
        )}
        <span className="text-xs font-medium truncate">{nodeData.title}</span>
      </div>

      {/* Page thumbnail via scaled HTML */}
      <div className="w-full overflow-hidden" style={{ height: 240 }}>
        <div
          style={{
            width: 375,
            height: 667,
            transform: "scale(0.53)",
            transformOrigin: "top left",
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <iframe
            srcDoc={buildThumbnailHtml(nodeData.htmlContent)}
            className="w-full h-full border-0"
            sandbox=""
            tabIndex={-1}
            title={`Thumbnail: ${nodeData.title}`}
          />
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-primary" />
    </div>
  );
}

function buildThumbnailHtml(htmlContent: string): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Inter, system-ui, sans-serif; pointer-events: none; user-select: none; overflow: hidden; }
</style>
</head><body>${htmlContent || '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#ccc;font-size:14px;">空页面</div>'}</body></html>`;
}

const nodeTypes = { pageNode: PageNode };

export function Panorama({ projectId }: PanoramaProps) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [navigations, setNavigations] = useState<NavigationInfo[]>([]);
  const selectedPageId = useWorkspaceStore((s) => s.selectedPageId);
  const setSelectedPageId = useWorkspaceStore((s) => s.setSelectedPageId);
  const setPreviewMode = useWorkspaceStore((s) => s.setPreviewMode);

  const handleSelectPage = useCallback(
    (pageId: string) => {
      setSelectedPageId(pageId);
      setPreviewMode("experience");
    },
    [setSelectedPageId, setPreviewMode]
  );

  useEffect(() => {
    fetchData();
  }, [projectId]);

  async function fetchData() {
    try {
      const [pagesRes, navsRes] = await Promise.all([
        fetch(`/api/prototype?projectId=${projectId}&action=list`),
        fetch(`/api/prototype?projectId=${projectId}&action=navigations`),
      ]);

      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        const pageList: PageInfo[] = pagesData.pages || [];

        const pagesWithContent = await Promise.all(
          pageList.map(async (p) => {
            try {
              const contentRes = await fetch(
                `/api/prototype?projectId=${projectId}&action=getPage&pageId=${p.pageId}`
              );
              if (contentRes.ok) {
                const contentData = await contentRes.json();
                return { ...p, htmlContent: contentData.htmlContent || "" };
              }
            } catch {}
            return { ...p, htmlContent: "" };
          })
        );
        setPages(pagesWithContent);
      }

      if (navsRes.ok) {
        const navsData = await navsRes.json();
        setNavigations(navsData.navigations || []);
      }
    } catch {}
  }

  const { initialNodes, initialEdges } = useMemo(() => {
    const COLS = 3;
    const X_GAP = 280;
    const Y_GAP = 360;

    const nodes: Node[] = pages.map((page, i) => ({
      id: page.pageId,
      type: "pageNode",
      position: {
        x: (i % COLS) * X_GAP,
        y: Math.floor(i / COLS) * Y_GAP,
      },
      data: {
        title: page.title,
        pageId: page.pageId,
        isEntry: page.isEntry,
        htmlContent: page.htmlContent || "",
        onSelectPage: handleSelectPage,
      },
      selected: page.pageId === selectedPageId,
    }));

    const edges: Edge[] = navigations.map((nav, i) => ({
      id: `nav-${i}`,
      source: nav.fromPageId,
      target: nav.toPageId,
      label: nav.trigger,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#6366f1", strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: "#6b7280" },
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [pages, navigations, selectedPageId, handleSelectPage]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedPageId(node.id);
    },
    [setSelectedPageId]
  );

  if (pages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">暂无页面</p>
          <p className="text-xs text-muted-foreground mt-1">
            在对话中创建页面后，跳转关系图将在这里展示
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
