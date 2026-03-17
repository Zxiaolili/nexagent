"use client";

import { type ReactNode } from "react";

interface DeviceFrameProps {
  type: "mobile" | "desktop";
  children: ReactNode;
}

const DEVICE_SIZES = {
  mobile: { width: 375, height: 812 },
  desktop: { width: 1280, height: 800 },
} as const;

export function DeviceFrame({ type, children }: DeviceFrameProps) {
  const size = DEVICE_SIZES[type];

  if (type === "desktop") {
    return (
      <div
        className="rounded-lg border border-[var(--color-border)] bg-white shadow-lg overflow-hidden"
        style={{ width: size.width, height: size.height, maxWidth: "100%", maxHeight: "100%" }}
      >
        <div className="h-8 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-3 gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="w-full" style={{ height: size.height - 32 }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-[2.5rem] border-[6px] border-[var(--color-border)] bg-white shadow-2xl overflow-hidden relative"
      style={{ width: size.width + 12, height: size.height + 12 }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-[var(--color-border)] rounded-b-2xl z-10" />
      <div className="w-full h-full rounded-[2rem] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
