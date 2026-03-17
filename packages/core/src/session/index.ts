import { nanoid } from "nanoid";
import type Database from "better-sqlite3";

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: string;
  toolCallId?: string;
  toolName?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export class SessionManager {
  constructor(private db: Database.Database) {}

  create(projectId: string, title = ""): Session {
    const id = nanoid(12);
    this.db
      .prepare(
        `INSERT INTO sessions (id, project_id, title) VALUES (?, ?, ?)`
      )
      .run(id, projectId, title);

    return this.get(id)!;
  }

  get(sessionId: string): Session | null {
    const row = this.db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .get(sessionId) as any;
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listByProject(projectId: string): Session[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC`
      )
      .all(projectId) as any[];
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  addMessage(
    sessionId: string,
    role: Message["role"],
    content: string,
    extra?: {
      toolCalls?: string;
      toolCallId?: string;
      toolName?: string;
    }
  ): Message {
    const id = nanoid(12);
    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id, tool_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        sessionId,
        role,
        content,
        extra?.toolCalls ?? null,
        extra?.toolCallId ?? null,
        extra?.toolName ?? null
      );

    this.db
      .prepare(`UPDATE sessions SET updated_at = datetime('now') WHERE id = ?`)
      .run(sessionId);

    return {
      id,
      sessionId,
      role,
      content,
      toolCalls: extra?.toolCalls,
      toolCallId: extra?.toolCallId,
      toolName: extra?.toolName,
      createdAt: new Date().toISOString(),
    };
  }

  updateTitle(sessionId: string, title: string): void {
    this.db
      .prepare("UPDATE sessions SET title = ? WHERE id = ?")
      .run(title, sessionId);
  }

  getMessages(sessionId: string): Message[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`
      )
      .all(sessionId) as any[];
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role,
      content: r.content,
      toolCalls: r.tool_calls,
      toolCallId: r.tool_call_id,
      toolName: r.tool_name,
      createdAt: r.created_at,
    }));
  }
}
