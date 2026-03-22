type Handler<T = any> = (data: T) => void;

export interface BusEvents {
  "page.created": { projectId: string; pageId: string; name: string };
  "page.updated": { projectId: string; pageId: string };
  "page.deleted": { projectId: string; pageId: string };
  "project.updated": { projectId: string };
  "session.message": {
    sessionId: string;
    role: "user" | "assistant";
    content: string;
    done: boolean;
  };
  "session.tool_call": {
    sessionId: string;
    toolCallId: string;
    toolName: string;
    /** Incremental UI updates; omit only on legacy payloads. */
    kind?: "start" | "args_delta" | "args_complete" | "result";
    argsTextDelta?: string;
    args?: Record<string, unknown>;
    result?: string;
    status: "running" | "completed" | "error";
  };
  "session.error": { sessionId: string; error: string };
}

type EventName = keyof BusEvents;

class EventBus {
  private listeners = new Map<string, Set<Handler>>();

  on<E extends EventName>(event: E, handler: Handler<BusEvents[E]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit<E extends EventName>(event: E, data: BusEvents[E]): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`[Bus] Error in handler for ${event}:`, err);
      }
    });
  }

  /**
   * Subscribe to all events — used by SSE to relay everything to the client.
   */
  onAll(handler: (event: string, data: unknown) => void): () => void {
    const unsubscribes: (() => void)[] = [];
    const events: EventName[] = [
      "page.created",
      "page.updated",
      "page.deleted",
      "project.updated",
      "session.message",
      "session.tool_call",
      "session.error",
    ];
    for (const event of events) {
      unsubscribes.push(
        this.on(event, (data) => handler(event, data))
      );
    }
    return () => unsubscribes.forEach((u) => u());
  }
}

export const bus = new EventBus();
