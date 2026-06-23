const BACKEND_URL = "http://127.0.0.1:18888";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  waitForBackend: async (maxRetries = 30, interval = 1000): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, interval));
      }
    }
    return false;
  },

  chat: {
    quickActions: () => request<{ title: string; prompt: string }[]>("/api/chat/quick-actions"),
    runtimeContext: (sessionId?: string) =>
      request<any>(
        `/api/chat/runtime-context${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`
      ),
    sessions: (params?: { include_archived?: boolean; archived?: boolean }) => {
      const search = new URLSearchParams();
      if (params?.include_archived !== undefined) {
        search.set("include_archived", String(params.include_archived));
      }
      if (params?.archived !== undefined) {
        search.set("archived", String(params.archived));
      }
      const query = search.toString();
      return request<any[]>(`/api/chat/sessions${query ? `?${query}` : ""}`);
    },
    session: (id: string) => request<any>(`/api/chat/sessions/${id}`),
    create: (data: any) =>
      request<any>("/api/chat/sessions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      request<any>(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ask: (data: {
      question: string;
      session_id?: string;
      knowledge_base_id?: string;
      model_config_id?: string;
      model?: string;
      top_k?: number;
    }) =>
      request<{
        answer: string;
        citations: any[];
        chunks_retrieved: number;
        model: string;
        model_config_id: string;
      }>("/api/chat/ask", { method: "POST", body: JSON.stringify(data) }),
    askStream: (
      data: {
        question: string;
        session_id?: string;
        knowledge_base_id?: string;
        model_config_id?: string;
        model?: string;
        top_k?: number;
      },
      onToken: (token: string) => void,
      onDone: (result: { content: string; model: string; model_config_id?: string; citations: any[] }) => void,
      onError: (err: Error) => void
    ): AbortController => {
      const controller = new AbortController();
      fetch(`${BACKEND_URL}/api/chat/ask/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            onError(new Error(`Stream error ${res.status}`));
            return;
          }
          const reader = res.body?.getReader();
          if (!reader) return;
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim() || !line.startsWith("data: ")) continue;
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.type === "token") {
                  onToken(parsed.content);
                } else if (parsed.type === "done") {
                  onDone({
                    content: parsed.content,
                    model: parsed.model,
                    model_config_id: parsed.model_config_id,
                    citations: parsed.citations,
                  });
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        })
        .catch((err) => onError(err));
      return controller;
    },
    delete: (id: string) =>
      request<any>(`/api/chat/sessions/${id}`, { method: "DELETE" }),
  },

  knowledge: {
    bases: () => request<any[]>("/api/knowledge/bases"),
    create: (data: any) =>
      request<any>("/api/knowledge/bases", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<any>(`/api/knowledge/bases/${id}`, { method: "DELETE" }),
    upload: (baseId: string, filePath: string) =>
      request<any>(`/api/knowledge/bases/${baseId}/upload`, {
        method: "POST",
        body: JSON.stringify({ file_path: filePath }),
      }),
    stats: () => request<any>("/api/knowledge/stats"),
    accessMatrix: () => request<any[]>("/api/knowledge/access-matrix"),
  },

  models: {
    providers: () => request<any[]>("/api/models/providers"),
    protocols: () => request<any[]>("/api/models/protocols"),
    chatOptions: () => request<any[]>("/api/models/chat-options"),
    create: (data: any) =>
      request<any>("/api/models/providers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateProvider: (providerId: string, data: any) =>
      request<any>(`/api/models/providers/${providerId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteProvider: (providerId: string) =>
      request<any>(`/api/models/providers/${providerId}`, { method: "DELETE" }),
    test: (providerId: string) =>
      request<any>(`/api/models/providers/${providerId}/test`, {
        method: "POST",
      }),
    sync: (providerId: string, data?: { protocol?: string; protocol_type?: string; overwrite?: boolean }) =>
      request<any>(`/api/models/providers/${providerId}/sync-models`, {
        method: "POST",
        body: JSON.stringify(data ?? { protocol: "openai", overwrite: false }),
      }),
    updateModel: (modelId: string, data: any) =>
      request<any>(`/api/models/configs/${encodeURIComponent(modelId)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  settings: {
    get: () => request<any>("/api/settings"),
    storage: () => request<any[]>("/api/settings/storage"),
    promptTemplates: () => request<any[]>("/api/settings/prompt-templates"),
    save: (data: any) =>
      request<any>("/api/settings", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
