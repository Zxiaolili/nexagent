"use client";

import { useEffect } from "react";

export interface ProjectTheme {
  primary?: string;
  bg?: string;
  radius?: string;
  font?: string;
  primaryColor?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  fontFamily?: string;
  borderRadius?: string;
}

/** Force entire app to use this palette; "auto" = follow project theme */
export type ColorSchemeOverride = "light" | "dark" | "auto";

const DEFAULT_DARK = {
  "--color-bg": "#0a0a0a",
  "--color-surface": "#141414",
  "--color-surface-2": "#1e1e1e",
  "--color-border": "#2a2a2a",
  "--color-text": "#e5e5e5",
  "--color-text-secondary": "#888",
  "--color-accent": "#3b82f6",
  "--color-accent-hover": "#2563eb",
} as const;

const DEFAULT_LIGHT = {
  "--color-bg": "#f5f5f5",
  "--color-surface": "#ffffff",
  "--color-surface-2": "#eeeeee",
  "--color-border": "#e0e0e0",
  "--color-text": "#111827",
  "--color-text-secondary": "#6b7280",
  "--color-accent": "#3b82f6",
  "--color-accent-hover": "#2563eb",
} as const;

function hexLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function applyThemeToDocument(
  theme: ProjectTheme | null,
  override: ColorSchemeOverride
) {
  const root = document.documentElement;

  if (override === "dark") {
    Object.entries(DEFAULT_DARK).forEach(([k, v]) => root.style.setProperty(k, v));
    return;
  }
  if (override === "light") {
    Object.entries(DEFAULT_LIGHT).forEach(([k, v]) => root.style.setProperty(k, v));
    return;
  }

  if (!theme || (!theme.primary && !theme.primaryColor && !theme.bg && !theme.backgroundColor)) {
    Object.entries(DEFAULT_DARK).forEach(([k, v]) => root.style.setProperty(k, v));
    return;
  }
  const primary = theme.primary ?? theme.primaryColor ?? "#3b82f6";
  const bg = theme.bg ?? theme.backgroundColor ?? "#0a0a0a";
  const fg = theme.foregroundColor;
  const font = theme.font ?? theme.fontFamily;

  root.style.setProperty("--color-accent", primary);
  root.style.setProperty("--color-accent-hover", primary);
  root.style.setProperty("--color-bg", bg);

  const isLight = hexLuminance(bg) > 0.5;
  if (isLight) {
    root.style.setProperty("--color-surface", adjustHex(bg, -0.02));
    root.style.setProperty("--color-surface-2", adjustHex(bg, -0.04));
    root.style.setProperty("--color-border", adjustHex(bg, -0.08));
    root.style.setProperty("--color-text", fg ?? "#111827");
    root.style.setProperty("--color-text-secondary", "#6b7280");
  } else {
    root.style.setProperty("--color-surface", adjustHex(bg, 0.03));
    root.style.setProperty("--color-surface-2", adjustHex(bg, 0.07));
    root.style.setProperty("--color-border", adjustHex(bg, 0.12));
    root.style.setProperty("--color-text", fg ?? "#e5e5e5");
    root.style.setProperty("--color-text-secondary", "#888");
  }
  if (font) root.style.setProperty("--font-family", font);
}

function adjustHex(hex: string, factor: number): string {
  const n = hex.replace("#", "");
  let r = parseInt(n.slice(0, 2), 16);
  let g = parseInt(n.slice(2, 4), 16);
  let b = parseInt(n.slice(4, 6), 16);
  r = Math.round(Math.min(255, Math.max(0, r + r * factor)));
  g = Math.round(Math.min(255, Math.max(0, g + g * factor)));
  b = Math.round(Math.min(255, Math.max(0, b + b * factor)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function useProjectTheme(
  projectId: string | null,
  theme: ProjectTheme | null,
  colorSchemeOverride: ColorSchemeOverride = "auto"
) {
  useEffect(() => {
    if (colorSchemeOverride !== "auto") {
      applyThemeToDocument(null, colorSchemeOverride);
      return;
    }
    if (!projectId) {
      applyThemeToDocument(null, "auto");
      return;
    }
    applyThemeToDocument(theme ?? null, "auto");
  }, [projectId, theme, colorSchemeOverride]);
}
