import type {
  ChatContentBlock,
  ChatMessage,
  ToolCallInfo,
} from "@/components/chat/chat-panel";

export interface SessionApiMessageRow {
  id: string;
  role: string;
  content: string;
  toolCalls?: string | null;
  toolCallId?: string | null;
  toolName?: string | null;
}

/**
 * Converts core session rows into chat UI messages.
 * Merges consecutive assistant rows (text and text+toolCalls steps) into one bubble
 * with blocks in chronological order: text → tools → text → tools → …
 */
export function sessionRowsToChatMessages(raw: SessionApiMessageRow[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let i = 0;

  while (i < raw.length) {
    const m = raw[i];

    if (m.role === "user") {
      out.push({
        id: m.id,
        role: "user",
        content: m.content,
      });
      i++;
      continue;
    }

    if (m.role === "tool") {
      i++;
      continue;
    }

    if (m.role === "assistant") {
      const blocks: ChatContentBlock[] = [];
      const startId = m.id;
      let j = i;

      while (j < raw.length && raw[j].role === "assistant") {
        const row = raw[j];

        if (row.toolCalls) {
          const prose = row.content ?? "";
          if (prose.trim()) {
            blocks.push({ type: "text", text: prose });
          }

          let parsed: { toolCallId: string; toolName: string; args: Record<string, unknown> }[];
          try {
            parsed = JSON.parse(row.toolCalls);
          } catch {
            j++;
            break;
          }

          j++;
          const results = new Map<string, string>();
          while (j < raw.length && raw[j].role === "tool") {
            const tr = raw[j];
            if (tr.toolCallId) results.set(tr.toolCallId, tr.content);
            j++;
          }

          for (const tc of parsed) {
            const full = results.get(tc.toolCallId) ?? "";
            const tool: ToolCallInfo = {
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              status: "completed",
              args: tc.args,
              result: full,
            };
            blocks.push({ type: "tool", tool });
          }
          continue;
        }

        const plain = row.content ?? "";
        if (plain.trim()) {
          blocks.push({ type: "text", text: plain });
        }
        j++;
      }

      if (blocks.length === 0) {
        i = j;
        continue;
      }

      const onlyOneText =
        blocks.length === 1 && blocks[0].type === "text";

      if (onlyOneText) {
        out.push({
          id: startId,
          role: "assistant",
          content: (blocks[0] as { type: "text"; text: string }).text,
        });
      } else {
        out.push({
          id: startId,
          role: "assistant",
          content: "",
          blocks,
        });
      }

      i = j;
      continue;
    }

    i++;
  }

  return out;
}
