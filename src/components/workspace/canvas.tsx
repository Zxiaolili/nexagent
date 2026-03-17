"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspaceStore } from "@/lib/store/workspace";
import { PreviewFrame } from "@/components/preview/preview-frame";
import { DeviceFrame } from "@/components/preview/device-frame";
import { Panorama } from "./panorama";
import {
  Maximize2,
  Smartphone,
  Monitor,
  Eye,
  Play,
  Map,
  ArrowLeft,
} from "lucide-react";

interface CanvasProps {
  projectId: string;
}

export function Canvas({ projectId }: CanvasProps) {
  const selectedPageId = useWorkspaceStore((s) => s.selectedPageId);
  const setSelectedPageId = useWorkspaceStore((s) => s.setSelectedPageId);
  const previewMode = useWorkspaceStore((s) => s.previewMode);
  const setPreviewMode = useWorkspaceStore((s) => s.setPreviewMode);
  const navigationHistory = useWorkspaceStore((s) => s.navigationHistory);
  const pushNavigation = useWorkspaceStore((s) => s.pushNavigation);
  const popNavigation = useWorkspaceStore((s) => s.popNavigation);
  const selectedElementId = useWorkspaceStore((s) => s.selectedElementId);
  const setSelectedElementId = useWorkspaceStore((s) => s.setSelectedElementId);

  const [htmlContent, setHtmlContent] = useState<string>("");
  const [deviceType, setDeviceType] = useState<"mobile" | "desktop">("mobile");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!selectedPageId) {
      setHtmlContent("");
      return;
    }
    fetchPageContent();
  }, [projectId, selectedPageId]);

  async function fetchPageContent() {
    try {
      const res = await fetch(
        `/api/prototype?projectId=${projectId}&action=getPage&pageId=${selectedPageId}`
      );
      if (res.ok) {
        const data = await res.json();
        setHtmlContent(data.htmlContent || "");
      }
    } catch {
      // API not yet implemented
    }
  }

  const handleNavigate = useCallback(
    (targetPageId: string) => {
      if (selectedPageId) {
        pushNavigation(selectedPageId);
      }
      setSelectedPageId(targetPageId);
    },
    [selectedPageId, pushNavigation, setSelectedPageId]
  );

  const handleBack = useCallback(() => {
    const prev = popNavigation();
    if (prev) {
      setSelectedPageId(prev);
    }
  }, [popNavigation, setSelectedPageId]);

  const handleElementSelect = useCallback(
    (elementId: string) => {
      setSelectedElementId(elementId);
    },
    [setSelectedElementId]
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== "object") return;
      switch (e.data.type) {
        case "navigate":
          if (e.data.pageId) handleNavigate(e.data.pageId);
          break;
        case "navigate-back":
          handleBack();
          break;
        case "element-selected":
          if (e.data.elementId) {
            handleElementSelect(e.data.elementId);
          }
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleNavigate, handleBack, handleElementSelect]);

  if (!selectedPageId && previewMode === "experience") {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <Eye className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            在右侧对话中描述你的产品想法
            <br />
            原型将在这里实时预览
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Canvas toolbar */}
      <div className="h-10 border-b bg-background flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewMode("experience")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              previewMode === "experience"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Play className="h-3 w-3" />
            体验
          </button>
          <button
            onClick={() => setPreviewMode("panorama")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              previewMode === "panorama"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Map className="h-3 w-3" />
            全景
          </button>

          {previewMode === "experience" && navigationHistory.length > 0 && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <button
                onClick={handleBack}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="返回上一页"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setDeviceType("mobile")}
            className={`p-1.5 rounded transition-colors ${
              deviceType === "mobile"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDeviceType("desktop")}
            className={`p-1.5 rounded transition-colors ${
              deviceType === "desktop"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview content */}
      {previewMode === "experience" ? (
        <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
          <DeviceFrame type={deviceType}>
            <PreviewFrame
              htmlContent={htmlContent}
              interactive={true}
              enableElementSelection={true}
              selectedElementId={selectedElementId}
            />
          </DeviceFrame>
        </div>
      ) : (
        <div className="flex-1">
          <Panorama projectId={projectId} />
        </div>
      )}
    </div>
  );
}
