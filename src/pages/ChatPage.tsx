import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Zap } from "lucide-react";
import { api } from "../services/api";

import { SessionList } from "../components/chat/SessionList";
import { MessageThread } from "../components/chat/MessageThread";
import { Composer } from "../components/chat/Composer";
import { ContextPanel } from "../components/chat/ContextPanel";
import type { ChatSession, Message } from "../components/chat/types";

const quickActions = [
  { title: "制度问答", prompt: "请解释差旅报销流程中需要主管审批的场景。" },
  { title: "合同审查", prompt: "识别合同中可能导致延期赔付争议的条款。" },
  { title: "工单分析", prompt: "汇总最近 7 天交付延期工单的主要原因。" },
];

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [backendOk, setBackendOk] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.waitForBackend(15, 1000).then(setBackendOk);
  }, []);

  useEffect(() => {
    if (!backendOk) return;
    api.chat.sessions().then((list: any[]) => {
      if (list.length > 0) {
        setSessions(
          list.map((s: any) => ({
            ...s,
            tags: typeof s.tags === "string" ? JSON.parse(s.tags) : s.tags,
            messages: [],
          }))
        );
        setActiveId(list[0].id);
      }
    });
  }, [backendOk]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? sessions[0],
    [activeId, sessions]
  );

  useEffect(() => {
    if (!activeId || !backendOk) return;
    api.chat.session(activeId).then((s: any) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeId
            ? {
                ...session,
                messages: (s.messages ?? []).map((m: any) => ({
                  ...m,
                  citations:
                    typeof m.citations === "string"
                      ? JSON.parse(m.citations)
                      : m.citations,
                })),
              }
            : session
        )
      );
    });
  }, [activeId, backendOk]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages.length, streamingText, isGenerating]);

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
      prev.map((s) =>
        s.id === activeSession.id
          ? { ...s, messages: [...s.messages, userMessage] }
          : s
      )
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
      },
      (token: string) => {
        setStreamingText((prev) => prev + token);
      },
      (result: any) => {
        setStreamingText("");
        setIsGenerating(false);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id
              ? {
                  ...s,
                  messages: [
                    ...s.messages,
                    {
                      id: assistantId,
                      role: "assistant",
                      author: "Enterprise AI",
                      content: result.content,
                      time: "现在",
                      model: result.model,
                      citations: result.citations?.map((c: any) => c.id || c.content) ?? [],
                    },
                  ],
                }
              : s
          )
        );
      },
      () => {
        setIsGenerating(false);
        setStreamingText("");
      }
    );
  }, [input, isGenerating, activeSession]);

  const handleNewSession = async () => {
    const id = `session-${Date.now()}`;
    await api.chat.create({ id, title: "新会话", model: "gpt-4o-mini" });
    setSessions((prev) => [
      { id, title: "新会话", scope: "", model: "gpt-4o-mini", messages: [] },
      ...prev,
    ]);
    setActiveId(id);
  };

  if (!backendOk) {
    return (
      <div className="workspace-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <Zap size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <h2>正在启动后端服务...</h2>
          <p style={{ opacity: 0.6 }}>请在 ai-backend 目录运行 <code>uv run python main.py</code></p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="workspace-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button className="primary-action" onClick={handleNewSession} type="button">
          <MessageSquare size={17} /> 创建第一个会话
        </button>
      </div>
    );
  }

  const allMessages = [...activeSession.messages];
  if (isGenerating && streamingText) {
    const lastMsg = allMessages[allMessages.length - 1];
    if (lastMsg?.role === "assistant") {
      allMessages[allMessages.length - 1] = {
        ...lastMsg,
        content: streamingText,
      };
    }
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
          messages={allMessages}
          isGenerating={isGenerating}
          streamingText={streamingText}
          messagesEndRef={messagesEndRef}
          quickActions={quickActions}
          onQuickAction={setInput}
        />

        <Composer
          input={input}
          isGenerating={isGenerating}
          onInputChange={setInput}
          onSend={handleSend}
        />
      </section>

      <ContextPanel activeSession={activeSession} />
    </div>
  );
}
