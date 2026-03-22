import { streamText, type CoreMessage, type CoreToolMessage } from "ai";
import { resolveProvider, type ProviderConfig } from "../provider/index.js";
import { buildTools } from "../tool/registry.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { buildMentionContextSuffix } from "./mention-context.js";
import { bus } from "../bus/index.js";
import { loadSkills } from "../skill/index.js";
import type { ProjectManager } from "../project/manager.js";
import type { SessionManager, Message } from "./index.js";

/** Subset of AI SDK fullStream parts we forward to the UI (SDK typings omit tool-result in some versions). */
type AgentUiStreamPart =
  | { type: "text-delta"; textDelta: string }
  | { type: "tool-call-streaming-start"; toolCallId: string; toolName: string }
  | { type: "tool-call-delta"; toolCallId: string; toolName: string; argsTextDelta: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown; isError?: boolean };

export interface RunOptions {
  sessionId: string;
  projectId: string;
  userMessage: string;
  skillsDir: string;
  providerConfig?: Partial<ProviderConfig>;
  signal?: AbortSignal;
}

export async function runAgent(
  pm: ProjectManager,
  sm: SessionManager,
  opts: RunOptions
): Promise<string> {
  const { sessionId, projectId, userMessage, skillsDir, providerConfig, signal } = opts;

  console.log("[runAgent] start", { sessionId, projectId, userMessagePreview: userMessage.slice(0, 40) });
  sm.addMessage(sessionId, "user", userMessage);

  const session = sm.get(sessionId);
  if (session && (!session.title || session.title === "New Chat")) {
    sm.updateTitle(sessionId, userMessage.slice(0, 50));
  }

  // Rebuild manifest each turn so the prompt reflects any pages created earlier
  const manifest = await pm.getManifest(projectId);
  const skills = await loadSkills(skillsDir);
  const rules = await pm.getRules(projectId);
  const systemPrompt = buildSystemPrompt({ manifest, skills, rules });
  const tools = buildTools({ pm, projectId, skillsDir, skills });
  console.log("[runAgent] manifest + tools ready", { sessionId, historyCount: sm.getMessages(sessionId).length });

  const historyMessages = sm.getMessages(sessionId);
  const coreMessages = rebuildCoreMessages(historyMessages);
  const mentionSuffix = await buildMentionContextSuffix(pm, projectId, userMessage);
  if (mentionSuffix) {
    const last = coreMessages[coreMessages.length - 1];
    if (last?.role === "user" && typeof last.content === "string") {
      last.content = `${last.content}\n\n${mentionSuffix}`;
    }
  }

  console.log("[runAgent] resolving provider", { sessionId, provider: providerConfig?.provider });
  const model = resolveProvider(providerConfig);
  console.log("[runAgent] provider resolved, calling streamText", { sessionId });

  let fullText = "";
  let chunkCount = 0;

  const result = streamText({
    model,
    system: systemPrompt,
    messages: coreMessages,
    tools,
    maxSteps: 15,
    abortSignal: signal,
    onStepFinish: (event) => {
      const calls = event.toolCalls as
        | { toolCallId: string; toolName: string; args: Record<string, unknown> }[]
        | undefined;
      const results = event.toolResults as
        | { toolCallId: string; toolName: string; result: unknown }[]
        | undefined;

      if (calls && calls.length > 0) {
        const stepText = event.text ?? "";
        sm.addMessage(sessionId, "assistant", stepText, {
          toolCalls: JSON.stringify(calls),
        });

        for (let i = 0; i < calls.length; i++) {
          const tc = calls[i];
          const tr = results?.[i];
          const resultText = formatToolResultText(tr?.result);

          sm.addMessage(sessionId, "tool", resultText, {
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
          });
        }
        console.log("[runAgent] onStepFinish tool calls", { sessionId, count: calls.length, names: calls.map((c) => c.toolName) });
        return;
      }

      const textOnly = (event.text ?? "").trim();
      if (textOnly) {
        sm.addMessage(sessionId, "assistant", event.text);
      }
    },
  });

  console.log("[runAgent] consuming fullStream", { sessionId });
  let streamAborted = false;
  try {
    const uiStream = result.fullStream as unknown as AsyncIterable<AgentUiStreamPart>;
    for await (const part of uiStream) {
      switch (part.type) {
        case "text-delta": {
          chunkCount++;
          const delta = part.textDelta;
          if (chunkCount <= 3) {
            console.log("[runAgent] text chunk", {
              sessionId,
              chunkIndex: chunkCount,
              part: delta.slice(0, 30),
            });
          }
          fullText += delta;
          bus.emit("session.message", {
            sessionId,
            role: "assistant",
            content: delta,
            done: false,
          });
          break;
        }
        case "tool-call-streaming-start":
          bus.emit("session.tool_call", {
            sessionId,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            kind: "start",
            status: "running",
          });
          break;
        case "tool-call-delta":
          bus.emit("session.tool_call", {
            sessionId,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            kind: "args_delta",
            argsTextDelta: part.argsTextDelta,
            status: "running",
          });
          break;
        case "tool-call":
          bus.emit("session.tool_call", {
            sessionId,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            kind: "args_complete",
            args: part.args as Record<string, unknown>,
            status: "running",
          });
          break;
        case "tool-result": {
          const resultText = formatToolResultText(part.result);
          bus.emit("session.tool_call", {
            sessionId,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            kind: "result",
            result: resultText,
            status: part.isError ? "error" : "completed",
          });
          break;
        }
        default:
          break;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (signal?.aborted || msg.includes("abort") || msg.includes("prematurely closed")) {
      console.log("[runAgent] stream aborted by client", { sessionId, chunkCount });
      streamAborted = true;
    } else {
      throw err;
    }
  }

  console.log("[runAgent] fullStream done", { sessionId, chunkCount, fullTextLength: fullText.length, streamAborted });

  bus.emit("session.message", {
    sessionId,
    role: "assistant",
    content: fullText,
    done: true,
  });

  return fullText;
}

/**
 * Rebuild Vercel AI SDK CoreMessage[] from our flat DB messages,
 * properly reconstructing tool_calls on assistant messages and
 * tool result messages.
 */
function rebuildCoreMessages(messages: Message[]): CoreMessage[] {
  const result: CoreMessage[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
      i++;
      continue;
    }

    if (msg.role === "assistant") {
      if (msg.toolCalls) {
        // This is an assistant message that made tool calls
        let parsed: any[];
        try {
          parsed = JSON.parse(msg.toolCalls);
        } catch {
          i++;
          continue;
        }

        result.push({
          role: "assistant",
          content: [
            ...(msg.content
              ? [{ type: "text" as const, text: msg.content }]
              : []),
            ...parsed.map((tc: any) => ({
              type: "tool-call" as const,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
            })),
          ],
        });

        // Collect the subsequent tool result messages
        const toolResults: CoreToolMessage["content"] = [];
        let j = i + 1;
        while (j < messages.length && messages[j].role === "tool") {
          const toolMsg = messages[j];
          toolResults.push({
            type: "tool-result",
            toolCallId: toolMsg.toolCallId || "",
            toolName: toolMsg.toolName || "",
            result: toolMsg.content,
          });
          j++;
        }

        if (toolResults.length > 0) {
          result.push({ role: "tool", content: toolResults });
        }

        i = j;
        continue;
      }

      // Regular assistant text message
      if (msg.content) {
        result.push({ role: "assistant", content: msg.content });
      }
      i++;
      continue;
    }

    // Skip orphan tool messages (shouldn't happen but be safe)
    i++;
  }

  return result;
}

function formatToolResultText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}
