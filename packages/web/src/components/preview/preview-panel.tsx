"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { Smartphone, Monitor, Maximize2, Minimize2, RefreshCw, ArrowLeft } from "lucide-react";

export interface PageItem {
  id: string;
  name: string;
}

interface PreviewPanelProps {
  projectId: string | null;
  pageId: string | null;
  refreshKey: number;
  onNavigate?: (pageId: string) => void;
  pages?: PageItem[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

type DeviceMode = "mobile" | "desktop";

export function PreviewPanel({
  projectId,
  pageId,
  refreshKey,
  onNavigate,
  pages = [],
  isFullscreen = false,
  onToggleFullscreen,
}: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceMode>("mobile");
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { t } = useI18n();

  const previewSrc =
    projectId && pageId ? `/preview/${projectId}/${pageId}` : null;

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "nexagent:navigate" && e.data?.pageId) {
        const targetPageId = e.data.pageId;
        if (pageId) {
          setNavHistory((prev) => [...prev, pageId]);
        }
        onNavigate?.(targetPageId);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [pageId, onNavigate]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onToggleFullscreen?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, onToggleFullscreen]);

  const handleBack = useCallback(() => {
    if (navHistory.length === 0) return;
    const prev = navHistory[navHistory.length - 1];
    setNavHistory((h) => h.slice(0, -1));
    onNavigate?.(prev);
  }, [navHistory, onNavigate]);

  if (!previewSrc) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">📱</div>
          <p className="text-sm">{t("chat.selectPage")}</p>
          <p className="text-xs mt-1 opacity-60">{t("chat.orAskAgent")}</p>
        </div>
      </div>
    );
  }

  const deviceWidth = device === "mobile" ? "375px" : "100%";
  const deviceHeight = device === "mobile" ? "812px" : "100%";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1">
          <button
            onClick={handleBack}
            disabled={navHistory.length === 0}
            className={cn(
              "p-1.5 rounded transition-colors",
              navHistory.length > 0
                ? "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                : "text-[var(--color-border)] cursor-not-allowed"
            )}
            title={t("chat.back")}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
          <button
            onClick={() => setDevice("mobile")}
            className={cn(
              "p-1.5 rounded transition-colors",
              device === "mobile"
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            )}
            title="Mobile"
          >
            <Smartphone size={16} />
          </button>
          <button
            onClick={() => setDevice("desktop")}
            className={cn(
              "p-1.5 rounded transition-colors",
              device === "desktop"
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            )}
            title="Desktop"
          >
            <Monitor size={16} />
          </button>
        </div>

        <span className="text-xs text-[var(--color-text-secondary)] font-mono">
          {pageId}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src;
              }
            }}
            className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            title={t("chat.refresh")}
          >
            <RefreshCw size={16} />
          </button>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
              title={isFullscreen ? t("chat.exitFullscreen") : t("chat.fullscreen")}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          {!isFullscreen && (
            <a
              href={previewSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
              title={t("chat.openNewTab")}
            >
              <Maximize2 size={16} />
            </a>
          )}
        </div>
      </div>

      {/* Preview area — use theme bg so it follows light/dark */}
      <div className="flex-1 flex items-start justify-center overflow-auto bg-[var(--color-bg)] p-4">
        <div
          className={cn(
            "overflow-hidden shadow-2xl transition-all duration-300 bg-[var(--color-surface-2)] border border-[var(--color-border)]",
            device === "mobile"
              ? "rounded-[2.5rem] border-[6px] border-[var(--color-border)] relative"
              : "rounded-lg"
          )}
          style={{
            width: isFullscreen && device === "desktop" ? "100%" : deviceWidth,
            height: device === "mobile" ? deviceHeight : "calc(100% - 2rem)",
            maxHeight: device === "mobile" ? deviceHeight : undefined,
          }}
        >
          {device === "mobile" && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[var(--color-border)] rounded-b-2xl z-10" />
          )}
          <iframe
            ref={iframeRef}
            key={`${previewSrc}-${refreshKey}`}
            src={previewSrc}
            className={cn(
              "w-full h-full border-0",
              device === "mobile" && "rounded-[2rem]"
            )}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            title="Prototype Preview"
          />
        </div>
      </div>

      {/* Page switcher tab bar (visible in fullscreen or when pages > 1) */}
      {pages.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => onNavigate?.(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors",
                p.id === pageId
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
