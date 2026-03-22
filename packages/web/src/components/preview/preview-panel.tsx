"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { Smartphone, Monitor, RefreshCw, ArrowLeft } from "lucide-react";

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
  /** Appended on the right of the toolbar after refresh (e.g. experience / panorama). */
  trailingToolbar?: ReactNode;
}

type DeviceMode = "mobile" | "desktop";

const MOBILE_W = 375;
const MOBILE_H = 812;
const DESKTOP_W = 1024;
const DESKTOP_H = 768;
const DESKTOP_CHROME_H = 28;
const DISPLAY_SCALE_STORAGE = "nexagent-preview-display-scale";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function PreviewPanel({
  projectId,
  pageId,
  refreshKey,
  onNavigate,
  pages = [],
  trailingToolbar,
}: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceMode>("mobile");
  const [displayScale, setDisplayScale] = useState(1);
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISPLAY_SCALE_STORAGE);
      const n = raw ? Number.parseFloat(raw) : NaN;
      if (!Number.isNaN(n)) setDisplayScale(clamp(n, 0.55, 1.25));
    } catch {
      /* ignore */
    }
  }, []);

  const setScalePersist = useCallback((v: number) => {
    const next = clamp(v, 0.55, 1.25);
    setDisplayScale(next);
    try {
      localStorage.setItem(DISPLAY_SCALE_STORAGE, String(next));
    } catch {
      /* ignore */
    }
  }, []);

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

  const handleBack = useCallback(() => {
    if (navHistory.length === 0) return;
    const prev = navHistory[navHistory.length - 1];
    setNavHistory((h) => h.slice(0, -1));
    onNavigate?.(prev);
  }, [navHistory, onNavigate]);

  const toolbarClass =
    "h-9 shrink-0 flex items-center justify-between gap-2 px-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]";

  if (!previewSrc) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {trailingToolbar ? (
          <div className={cn(toolbarClass, "shrink-0 justify-end")}>
            <div className="flex items-center gap-0.5 shrink-0">{trailingToolbar}</div>
          </div>
        ) : null}
        <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--color-text-secondary)]">
          <div className="text-center">
            <div className="text-4xl mb-3 opacity-30">📱</div>
            <p className="text-sm">{t("chat.selectPage")}</p>
            <p className="text-xs mt-1 opacity-60">{t("chat.orAskAgent")}</p>
          </div>
        </div>
      </div>
    );
  }

  const scale = displayScale;

  const mobileFrame = (
    <div
      className="relative overflow-hidden bg-[var(--color-surface-2)] shadow-lg"
      style={{
        width: MOBILE_W * scale,
        height: MOBILE_H * scale,
        borderRadius: "1.5rem",
        border: "4px solid var(--color-border)",
      }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 bg-[var(--color-border)] rounded-b-lg z-10 pointer-events-none"
        style={{ width: 56, height: 5 }}
      />
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-border)] z-10 pointer-events-none"
        style={{ width: 48, height: 4 }}
      />
      <div
        className="overflow-hidden rounded-[1.25rem]"
        style={{
          width: MOBILE_W,
          height: MOBILE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <iframe
          ref={iframeRef}
          key={`${previewSrc}-${refreshKey}`}
          src={previewSrc}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          title="Prototype Preview"
        />
      </div>
    </div>
  );

  const desktopFrame = (
    <div
      className="overflow-hidden bg-[var(--color-surface-2)] shadow-lg border border-[var(--color-border)] rounded-lg"
      style={{
        width: (DESKTOP_W + 2) * scale,
        height: (DESKTOP_H + DESKTOP_CHROME_H + 2) * scale,
      }}
    >
      <div
        style={{
          width: DESKTOP_W + 2,
          height: DESKTOP_H + DESKTOP_CHROME_H + 2,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          className="flex items-center gap-1.5 px-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]"
          style={{ height: DESKTOP_CHROME_H }}
        >
          <div className="w-[6px] h-[6px] rounded-full bg-[#ff5f57]" />
          <div className="w-[6px] h-[6px] rounded-full bg-[#febc2e]" />
          <div className="w-[6px] h-[6px] rounded-full bg-[#28c840]" />
          <div className="flex-1 mx-2 h-3 bg-[var(--color-surface-2)] rounded-sm min-w-0" />
        </div>
        <iframe
          ref={iframeRef}
          key={`${previewSrc}-${refreshKey}`}
          src={previewSrc}
          className="w-full border-0"
          style={{ width: DESKTOP_W, height: DESKTOP_H }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          title="Prototype Preview"
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={toolbarClass}>
        <div className="flex items-center gap-0.5 min-w-0 min-h-0">
          <button
            type="button"
            onClick={handleBack}
            disabled={navHistory.length === 0}
            className={cn(
              "p-1 rounded transition-colors shrink-0",
              navHistory.length > 0
                ? "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                : "text-[var(--color-border)] cursor-not-allowed"
            )}
            title={t("chat.back")}
          >
            <ArrowLeft size={15} />
          </button>
          <div className="w-px h-3.5 bg-[var(--color-border)] mx-0.5 shrink-0" />
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={cn(
              "p-1 rounded transition-colors shrink-0",
              device === "mobile"
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            )}
            title="Mobile"
          >
            <Smartphone size={15} />
          </button>
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={cn(
              "p-1 rounded transition-colors shrink-0",
              device === "desktop"
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            )}
            title="Desktop"
          >
            <Monitor size={15} />
          </button>
          <div className="w-px h-3.5 bg-[var(--color-border)] mx-0.5 shrink-0" />
          <label className="flex items-center gap-1.5 min-w-0 max-w-[120px] sm:max-w-[180px]">
            <span className="text-[10px] text-[var(--color-text-secondary)] whitespace-nowrap shrink-0">
              {t("preview.displayScale")}
            </span>
            <input
              type="range"
              min={0.55}
              max={1.25}
              step={0.05}
              value={displayScale}
              onChange={(e) => setScalePersist(Number.parseFloat(e.target.value))}
              className="w-full min-w-0 h-1 accent-[var(--color-accent)] cursor-pointer"
            />
          </label>
        </div>

        <span className="text-[11px] text-[var(--color-text-secondary)] font-mono truncate mx-1 min-w-0">
          {pageId}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src;
              }
            }}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            title={t("chat.refresh")}
          >
            <RefreshCw size={15} />
          </button>
          {trailingToolbar ? (
            <>
              <div className="w-px h-3.5 bg-[var(--color-border)] mx-0.5 shrink-0" />
              <div className="flex h-full items-center gap-0.5 shrink-0">{trailingToolbar}</div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-start justify-center overflow-auto bg-[var(--color-bg)] p-4">
        {device === "mobile" ? mobileFrame : desktopFrame}
      </div>

      {pages.length > 1 && (
        <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2.5">
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onNavigate?.(p.id)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] whitespace-nowrap transition-colors",
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
