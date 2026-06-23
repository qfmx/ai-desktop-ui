import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Zap } from "lucide-react";
import { api } from "../services/api";
import { SessionList } from "../components/chat/SessionList";
import { MessageThread } from "../components/chat/MessageThread";
import { Composer } from "../components/chat/Composer";
import type { ChatSession, Message, QuickAction } from "../types/chat";
import type { ChatModelGroup, ChatModelOption } from "../types/model";

type ChatSettings = {
  default_chat_model_config_id: string;
  default_llm_model: string;
  default_top_k: number;
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
    modelConfigId: raw.model_config_id || "",
    tags: parseJsonList(raw.tags),
    archived: Boolean(raw.archived),
    archivedAt: raw.archived_at || "",
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
    modelConfigId: raw.model_config_id || undefined,
    tokens: raw.tokens || undefined,
    citations: parseJsonList(raw.citations),
  };
}

function flattenChatModels(groups: ChatModelGroup[]): ChatModelOption[] {
  return groups.flatMap((group) =>
    group.models.map((model) => ({
      providerId: group.provider_id,
      providerName: group.provider_name,
      protocolType: group.protocol_type,
      modelConfigId: model.model_config_id,
      displayName: model.display_name,
      modelName: model.model_name,
    })),
  );
}

function titleFromQuestion(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  const maxLength = 24;
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function shouldUseQuestionAsTitle(title: string) {
  return !title || title === "新会话" || title === "新回话";
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [backendOk, setBackendOk] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [chatModels, setChatModels] = useState<ChatModelOption[]>([]);
  const [selectedModelConfigId, setSelectedModelConfigId] = useState("");
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    default_chat_model_config_id: "",
    default_llm_model: "",
    default_top_k: 8,
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
      Promise.all([api.settings.get(), api.models.chatOptions()]).then(([settings, modelGroups]) => {
        const models = flattenChatModels(modelGroups);
        setChatModels(models);
        setSelectedModelConfigId(
          settings.default_chat_model_config_id || models[0]?.modelConfigId || ""
        );
        setChatSettings({
          default_chat_model_config_id: settings.default_chat_model_config_id ?? "",
          default_llm_model: settings.default_llm_model ?? "",
          default_top_k: settings.default_top_k ?? 8,
        });
      }),
    ]);
  }, [backendOk, loadSessions]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId) ?? sessions[0],
    [activeId, sessions],
  );
  const selectedChatModel = useMemo(
    () =>
      chatModels.find(
        (model) =>
          model.modelConfigId === (selectedModelConfigId || activeSession?.modelConfigId),
      ),
    [activeSession?.modelConfigId, chatModels, selectedModelConfigId],
  );
  const firstChatModelId = chatModels[0]?.modelConfigId || "";

  useEffect(() => {
    if (!activeId || !backendOk) return;
    api.chat.session(activeId).then((session) => {
      setSelectedModelConfigId((current) => session.model_config_id || current || firstChatModelId);
      setSessions((prev) =>
        prev.map((item) =>
          item.id === activeId
            ? {
                ...item,
                model: session.model || item.model,
                modelConfigId: session.model_config_id || item.modelConfigId,
                messages: (session.messages ?? []).map(mapMessage),
              }
            : item,
        ),
      );
    });
  }, [activeId, backendOk, firstChatModelId]);

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
    const nextTitle = titleFromQuestion(content);
    const shouldRenameSession =
      shouldUseQuestionAsTitle(activeSession.title) && activeSession.messages.length === 0;

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
          ? {
              ...session,
              title: shouldRenameSession ? nextTitle : session.title,
              messages: [...session.messages, userMessage],
            }
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
        model_config_id: selectedModelConfigId || activeSession.modelConfigId || undefined,
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
                      modelConfigId: result.model_config_id || selectedModelConfigId,
                      citations: result.citations?.map((item: any) => item.id || item.content) ?? [],
                    },
                  ],
                }
              : session,
          ),
        );
      },
      () => {
        setIsGenerating(false);
        setStreamingText("");
      },
    );
  }, [activeSession, chatSettings.default_top_k, input, isGenerating, selectedModelConfigId]);

  const handleModelChange = (modelConfigId: string) => {
    setSelectedModelConfigId(modelConfigId);
    const model = chatModels.find((item) => item.modelConfigId === modelConfigId);
    if (!activeSession) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSession.id
          ? {
              ...session,
              model: model?.displayName || session.model,
              modelConfigId,
            }
          : session,
      ),
    );
    api.chat
      .update(activeSession.id, { model_config_id: modelConfigId })
      .catch(() => {});
  };

  const removeSessionLocally = useCallback(
    (id: string) => {
      const nextSessions = sessions.filter((session) => session.id !== id);
      setSessions(nextSessions);
      setActiveId((current) => (current === id ? nextSessions[0]?.id || "" : current));
    },
    [sessions],
  );

  const handleRenameSession = useCallback(
    async (id: string, title: string) => {
      setSessions((prev) =>
        prev.map((session) => (session.id === id ? { ...session, title } : session)),
      );
      try {
        await api.chat.update(id, { title });
      } catch (error) {
        await loadSessions();
        throw error;
      }
    },
    [loadSessions],
  );

  const handleUpdateSessionTags = useCallback(
    async (id: string, tags: string[]) => {
      setSessions((prev) =>
        prev.map((session) => (session.id === id ? { ...session, tags } : session)),
      );
      try {
        await api.chat.update(id, { tags });
      } catch (error) {
        await loadSessions();
        throw error;
      }
    },
    [loadSessions],
  );

  const handleArchiveSession = useCallback(
    (id: string) => {
      removeSessionLocally(id);
      api.chat.update(id, { archived: true }).catch(() => {
        void loadSessions();
      });
    },
    [loadSessions, removeSessionLocally],
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      removeSessionLocally(id);
      api.chat.delete(id).catch(() => {
        void loadSessions();
      });
    },
    [loadSessions, removeSessionLocally],
  );

  const handleNewSession = async () => {
    const id = `session-${Date.now()}`;
    const modelConfigId =
      selectedModelConfigId ||
      chatSettings.default_chat_model_config_id ||
      chatModels[0]?.modelConfigId ||
      "";
    const model = chatModels.find((item) => item.modelConfigId === modelConfigId);
    await api.chat.create({
      id,
      title: "新会话",
      model_config_id: modelConfigId || undefined,
    });
    const session: ChatSession = {
      id,
      title: "新会话",
      scope: "",
      model: model?.displayName || chatSettings.default_llm_model,
      modelConfigId,
      tags: [],
      archived: false,
      archivedAt: "",
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
            打包版会自动启动后端；开发模式请在 <code>ai-backend</code> 目录运行{" "}
            <code>uv run python main.py</code>
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
        onRename={handleRenameSession}
        onUpdateTags={handleUpdateSessionTags}
        onArchive={handleArchiveSession}
        onDelete={handleDeleteSession}
      />

      <section className="chat-surface">
        <div className="chat-toolbar">
          <div>
            <span className="eyebrow">Q&A</span>
            <h2>{activeSession.title}</h2>
          </div>
          <div className="chat-toolbar-meta">
            <span>{activeSession.scope || "默认知识库"}</span>
            <strong>
              {selectedChatModel
                ? `${selectedChatModel.providerName} / ${selectedChatModel.displayName}`
                : activeSession.model || "未选择模型"}
            </strong>
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
          knowledgeScope={activeSession.scope || "默认知识库"}
          chatModels={chatModels}
          selectedModelConfigId={selectedModelConfigId}
          onInputChange={setInput}
          onModelChange={handleModelChange}
          onSend={handleSend}
        />
      </section>
    </div>
  );
}
