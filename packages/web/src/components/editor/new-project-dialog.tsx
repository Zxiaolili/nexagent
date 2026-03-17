"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, platform: "mobile" | "desktop") => void;
}

export function NewProjectDialog({
  open,
  onClose,
  onCreate,
}: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"mobile" | "desktop">("mobile");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setPlatform("mobile");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), platform);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        >
          <X size={16} />
        </button>

        <h2 className="text-lg font-semibold mb-4">New Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[var(--color-text-secondary)] block mb-1.5">
              Project Name
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 外卖APP, Task Manager..."
              className={cn(
                "w-full bg-[var(--color-surface-2)] rounded-lg px-3 py-2",
                "text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]",
                "border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
              )}
            />
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-secondary)] block mb-1.5">
              Platform
            </label>
            <div className="flex gap-2">
              {(["mobile", "desktop"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium border transition-colors",
                    platform === p
                      ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)]"
                  )}
                >
                  {p === "mobile" ? "📱 Mobile" : "🖥 Desktop"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className={cn(
              "w-full py-2.5 rounded-lg text-sm font-medium transition-colors",
              name.trim()
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] cursor-not-allowed"
            )}
          >
            Create Project
          </button>
        </form>
      </div>
    </div>
  );
}
