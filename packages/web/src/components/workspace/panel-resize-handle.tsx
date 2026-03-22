"use client";

import { useState, useCallback, useRef, type RefObject } from "react";
import { cn } from "@/lib/cn";

function clampPx(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

interface VerticalPanelResizeHandleProps {
  onResizeDelta: (deltaX: number) => void;
  title?: string;
}

export function VerticalPanelResizeHandle({
  onResizeDelta,
  title,
}: VerticalPanelResizeHandleProps) {
  const [dragging, setDragging] = useState(false);

  const endDrag = useCallback(() => setDragging(false), []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title={title}
      className={cn(
        "relative z-10 w-3 shrink-0 cursor-col-resize select-none touch-none",
        "flex justify-center mx-[-5px]"
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          onResizeDelta(e.movementX);
        }
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        endDrag();
      }}
      onPointerCancel={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        endDrag();
      }}
    >
      <span
        className={cn(
          "pointer-events-none w-px self-stretch min-h-full transition-[background-color] duration-150",
          dragging
            ? "bg-[var(--color-accent)]"
            : "bg-[var(--color-border)] hover:bg-[var(--color-accent)]"
        )}
      />
    </div>
  );
}

interface TrackedHorizontalResizeHandleProps {
  title?: string;
  stackRef: RefObject<HTMLDivElement | null>;
  minTopPx: number;
  minBottomPx: number;
  getTopHeight: () => number;
  onTopHeightChange: (heightPx: number) => void;
}

export function TrackedHorizontalResizeHandle({
  title,
  stackRef,
  minTopPx,
  minBottomPx,
  getTopHeight,
  onTopHeightChange,
}: TrackedHorizontalResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const sessionRef = useRef<{ startY: number; startH: number } | null>(null);

  const endDrag = useCallback(() => {
    setDragging(false);
    sessionRef.current = null;
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      title={title}
      className={cn(
        "relative z-10 h-3 shrink-0 cursor-row-resize select-none touch-none",
        "flex flex-col justify-center my-[-5px]"
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        sessionRef.current = {
          startY: e.clientY,
          startH: getTopHeight(),
        };
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const sess = sessionRef.current;
        const stack = stackRef.current;
        if (!sess || !stack) return;
        const stackH = stack.getBoundingClientRect().height;
        const handlePx = 12;
        const maxTop = Math.max(minTopPx, stackH - handlePx - minBottomPx);
        const next = clampPx(
          sess.startH + (e.clientY - sess.startY),
          minTopPx,
          maxTop
        );
        onTopHeightChange(next);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        endDrag();
      }}
      onPointerCancel={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        endDrag();
      }}
    >
      <span
        className={cn(
          "pointer-events-none h-px w-full min-w-full transition-[background-color] duration-150",
          dragging
            ? "bg-[var(--color-accent)]"
            : "bg-[var(--color-border)] hover:bg-[var(--color-accent)]"
        )}
      />
    </div>
  );
}
