"use client";

import { useEffect, useRef, useCallback } from "react";

// process.env.NEXT_PUBLIC_* is replaced at compile time by Next.js/turbopack.
// Do NOT guard with `typeof process` — turbopack doesn't polyfill `process` on the client,
// which would make CORE_BASE always "" and route everything through the rewrite proxy.
const CORE_BASE = process.env.NEXT_PUBLIC_CORE_URL ?? "";

/**
 * Subscribe to the global SSE event stream from the core server.
 * EventSource dispatches each event as a separate macrotask,
 * which guarantees React renders between events (no batching).
 */
export function useEventSource(
  onEvent: (event: string, data: any) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const es = new EventSource(`${CORE_BASE}/events`);

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onEventRef.current(e.type, data);
      } catch {
        // ignore malformed
      }
    };

    const eventTypes = [
      "page.created",
      "page.updated",
      "page.deleted",
      "project.updated",
      "session.message",
      "session.tool_call",
      "session.error",
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, handler);
    }

    return () => es.close();
  }, []);
}

/**
 * Send a chat message and cancel running agents.
 * Responses arrive via EventSource (session.message / session.error events).
 */
export function useChatStream() {
  const send = useCallback(
    async (sessionId: string, message: string) => {
      const res = await fetch(
        `${CORE_BASE}/api/sessions/${sessionId}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Chat request failed: ${res.status} ${text}`);
      }
    },
    []
  );

  const cancel = useCallback(async (sessionId: string) => {
    await fetch(`${CORE_BASE}/api/sessions/${sessionId}/cancel`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  return { send, cancel };
}
