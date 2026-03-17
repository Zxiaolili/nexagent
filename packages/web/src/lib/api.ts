const BASE = process.env.NEXT_PUBLIC_CORE_URL || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  listProjects: () =>
    request<{ id: string; name: string }[]>("/api/projects"),

  createProject: (name: string) =>
    request<{ id: string; name: string }>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),

  getProject: (id: string) =>
    request<any>(`/api/projects/${id}`),

  listPages: (projectId: string) =>
    request<{ id: string; name: string; description: string }[]>(
      `/api/projects/${projectId}/pages`
    ),

  getPage: (projectId: string, pageId: string) =>
    request<{ id: string; content: string }>(
      `/api/projects/${projectId}/pages/${pageId}`
    ),

  listSessions: (projectId: string) =>
    request<any[]>(`/api/projects/${projectId}/sessions`),

  createSession: (projectId: string, title?: string) =>
    request<any>(`/api/projects/${projectId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),

  getMessages: (sessionId: string) =>
    request<any[]>(`/api/sessions/${sessionId}/messages`),

  listFiles: (projectId: string) =>
    request<{ path: string; name: string; type: "file" | "directory" }[]>(
      `/api/projects/${projectId}/files`
    ),

  getFlows: (projectId: string) =>
    request<any>(`/api/projects/${projectId}`).then(
      (p: any) => (p.flows || []) as { from: string; to: string; trigger: string }[]
    ),

  previewUrl: (projectId: string, pageId: string) =>
    `${BASE}/preview/${projectId}/${pageId}`,

  downloadUrl: (projectId: string) =>
    `${BASE}/api/projects/${projectId}/download`,

  shareProject: (projectId: string) =>
    request<{ token: string }>(`/api/projects/${projectId}/share`, {
      method: "POST",
    }),

  shareUrl: (token: string) => `${BASE}/share/${token}`,
};
