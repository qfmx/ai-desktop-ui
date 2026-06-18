import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Zap } from "lucide-react";
import { api } from "../services/api";
import { SessionList } from "../components/chat/SessionList";
import { MessageThread } from "../components/chat/MessageThread";
import { Composer } from "../components/chat/Composer";
import { ContextPanel } from "../components/chat/ContextPanel";
import type { ChatSession, Message, QuickAction, RuntimeContext } from "../types/chat";

type ChatSettings = {
  default_llm_model: string;
  default_top_k: number;
  default_temperature: number;
};

function parseJsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapSession(raw: any): ChatSession {
  return {
    id: raw.id,
    title: raw.title,
    scope: raw.scope || "",
    model: raw.model || "",
    tags: parseJsonList(raw.tags),
    messages: [],
  };
}

function mapMessage(raw: any): Message {
  return {
    id: raw.id,
    role: raw.role,
    author: raw.role === "assistant" ? "Enterprise AI" : "你",
    content: raw.content,
    time: raw.created_at || "",
    model: raw.model || undefined,
    tokens: raw.tokens || undefined,
    citations: parseJsonList(raw.citations),
  };
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [backendOk, setBackendOk] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [runtimeContext, setRuntimeContext] = useState<RuntimeContext | null>(null);
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    default_llm_model: "",
    default_top_k: 8,
    default_temperature: 0.4,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.waitForBackend(15, 1000).then(setBackendOk);
  }, []);

  const loadSessions = useCallback(async () => {
    const list = await api.chat.sessions();
    const mapped = list.map(mapSession);
    setSessions(mapped);
    setActiveId((current) => current || mapped[0]?.id || "");
  }, []);

  useEffect(() => {
    if (!backendOk) return;
    void Promise.all([
      loadSessions(),
      api.chat.quickActions().then(setQuickActions),
      api.settings.get().then((settings) => {
        setChatSettings({
          default_llm_model: settings.default_llm_model ?? "",
          default_top_k: settings.default_top_k ?? 8,
          default_temperature: settings.default_temperature ?? 0.4,
        });
      }),
    ]);
  }, [backendOk, loadSessions]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId) ?? sessions[0],
    [activeId, sessions],
  );

  useEffect(() => {
    if (!activeId || !backendOk) return;
    api.chat.session(activeId).then((session) => {
      setSessions((prev) =>
        prev.map((item) =>
          item.id === activeId
            ? {
                ...item,
                messages: (session.messages ?? []).map(mapMessage),
              }
            : item,
        ),
      );
    });
    api.chat.runtimeContext(activeId).then(setRuntimeContext);
  }, [activeId, backendOk]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages.length, streamingText, isGenerating]);

  useEffect(() => {
    return () => {
      streamRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content || isGenerating || !activeSession) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      author: "你",
      content,
      time: "现在",
    };

    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSession.id
          ? { ...session, messages: [...session.messages, userMessage] }
          : session,
      ),
    );
    setInput("");
    setIsGenerating(true);
    setStreamingText("");

    const assistantId = `a-${Date.now()}`;

    streamRef.current = api.chat.askStream(
      {
        question: content,
        session_id: activeSession.id,
        model: activeSession.model || undefined,
        top_k: chatSettings.default_top_k,
      },
      (token) => {
        setStreamingText((prev) => prev + token);
      },
      (result) => {
        setStreamingText("");
        setIsGenerating(false);
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  messages: [
                    ...session.messages,
                    {
                      id: assistantId,
                      role: "assistant",
                      author: "Enterprise AI",
                      content: result.content,
                      time: "现在",
                      model: result.model,
                      citations: result.citations?.map((item: any) => item.id || item.content) ?? [],
                    },
                  ],
                }
              : session,
          ),
        );
        api.chat.runtimeContext(activeSession.id).then(setRuntimeContext);
      },
      () => {
        setIsGenerating(false);
        setStreamingText("");
      },
    );
  }, [activeSession, chatSettings.default_top_k, input, isGenerating]);

  const handleNewSession = async () => {
    const id = `session-${Date.now()}`;
    await api.chat.create({
      id,
      title: "新会话",
      model: chatSettings.default_llm_model || undefined,
    });
    const session: ChatSession = {
      id,
      title: "新会话",
      scope: "",
      model: chatSettings.default_llm_model,
      messages: [],
    };
    setSessions((prev) => [session, ...prev]);
    setActiveId(id);
  };

  if (!backendOk) {
    return (
      <div className="workspace-page center-state">
        <div>
          <Zap size={48} />
          <h2>正在连接后端服务</h2>
          <p>
            请在 <code>ai-backend</code> 目录运行 <code>uv run python main.py</code>
          </p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="workspace-page center-state">
        <button className="primary-action" onClick={handleNewSession} type="button">
          <MessageSquare size={17} />
          创建第一个会话
        </button>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      <SessionList
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNewSession={handleNewSession}
      />

      <section className="chat-surface">
        <div className="chat-toolbar">
          <div>
            <span className="eyebrow">Q&A</span>
            <h2>{activeSession.title}</h2>
          </div>
          <div className="segmented-control" aria-label="检索模式">
            <button className="active" type="button">企业库</button>
            <button type="button">网页</button>
            <button type="button">混合</button>
          </div>
        </div>

        <MessageThread
          messages={activeSession.messages}
          isGenerating={isGenerating}
          streamingText={streamingText}
          messagesEndRef={messagesEndRef}
          quickActions={quickActions}
          onQuickAction={setInput}
        />

        <Composer
          input={input}
          isGenerating={isGenerating}
          knowledgeScope={runtimeContext?.scope || activeSession.scope || "默认知识库"}
          topK={chatSettings.default_top_k}
          temperature={chatSettings.default_temperature}
          onInputChange={setInput}
          onSend={handleSend}
        />
      </section>

      <ContextPanel context={runtimeContext} activeSession={activeSession} />
    </div>
  );
}
