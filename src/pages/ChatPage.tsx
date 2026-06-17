import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Copy,
  Cpu,
  Database,
  FileText,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Workflow,
  Zap,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  author: string;
  content: string;
  time: string;
  model?: string;
  tokens?: number;
  citations?: string[];
};

type ChatSession = {
  id: string;
  title: string;
  scope: string;
  model: string;
  messages: Message[];
};

const initialSessions: ChatSession[] = [
  {
    id: "delivery-risk",
    title: "交付延期风险归因",
    scope: "售后工单库",
    model: "GPT-4.1",
    messages: [
      {
        id: "m1",
        role: "user",
        author: "运营负责人",
        content: "把上周客户反馈中关于交付延期的主要原因做一个归纳，并引用对应工单。",
        time: "10:24",
      },
      {
        id: "m2",
        role: "assistant",
        author: "Enterprise AI",
        content:
          "已基于售后工单知识库完成聚类。主要原因集中在供应链排期变更、客户侧验收窗口延后、跨区域物流节点拥堵三类。",
        time: "10:24",
        model: "GPT-4.1",
        tokens: 428,
        citations: ["CS-2026-1182", "CS-2026-1207", "CS-2026-1221"],
      },
      {
        id: "m3",
        role: "assistant",
        author: "Enterprise AI",
        content:
          "建议将高频延误场景同步到交付风险看板，并为华东区新增提前 48 小时预警规则。",
        time: "10:25",
        model: "GPT-4.1",
        tokens: 196,
        citations: ["SOP-DELIVERY-08", "RISK-OPS-14"],
      },
    ],
  },
  {
    id: "contract-review",
    title: "合同风险条款识别",
    scope: "法务合同库",
    model: "Claude 3.5 Sonnet",
    messages: [
      {
        id: "m4",
        role: "user",
        author: "法务经理",
        content: "检查这份采购合同中的交付、违约和数据安全条款。",
        time: "昨天 16:12",
      },
    ],
  },
  {
    id: "meeting-summary",
    title: "季度经营会纪要",
    scope: "企业制度与会议纪要",
    model: "GPT-4.1",
    messages: [],
  },
];

const quickActions = [
  { title: "制度问答", prompt: "请解释差旅报销流程中需要主管审批的场景。" },
  { title: "合同审查", prompt: "识别合同中可能导致延期赔付争议的条款。" },
  { title: "工单分析", prompt: "汇总最近 7 天交付延期工单的主要原因。" },
];

const pipeline = [
  { label: "意图识别", value: "已完成", tone: "green" },
  { label: "知识检索", value: "18 条", tone: "cyan" },
  { label: "权限过滤", value: "已通过", tone: "amber" },
  { label: "响应生成", value: "流式", tone: "rose" },
];

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [activeId, setActiveId] = useState(initialSessions[0].id);
  const [input, setInput] = useState("请基于售后工单库，生成交付延期风险的处理建议。");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId) ?? sessions[0],
    [activeId, sessions],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession.messages.length, isGenerating]);

  const handleSend = () => {
    const content = input.trim();
    if (!content || isGenerating) return;

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

    window.setTimeout(() => {
      const assistantMessage: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        author: "Enterprise AI",
        content:
          "已生成处理建议: 优先建立延期风险分层、在交付节点前置客户确认、将供应链变更纳入 48 小时预警，并把重复工单同步给区域负责人。",
        time: "现在",
        model: activeSession.model,
        tokens: 238,
        citations: ["CS-2026-1207", "SOP-DELIVERY-08", "RISK-OPS-14"],
      };

      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id
            ? { ...session, messages: [...session.messages, assistantMessage] }
            : session,
        ),
      );
      setIsGenerating(false);
    }, 700);
  };

  return (
    <div className="chat-layout">
      <aside className="session-panel">
        <button className="primary-action" type="button">
          <MessageSquare size={17} />
          新建会话
        </button>
        <div className="session-list">
          {sessions.map((session) => (
            <button
              className={`session-card ${session.id === activeId ? "active" : ""}`}
              key={session.id}
              onClick={() => setActiveId(session.id)}
              type="button"
            >
              <strong>{session.title}</strong>
              <span>{session.scope}</span>
              <small>{session.model} · {session.messages.length} 条消息</small>
            </button>
          ))}
        </div>
      </aside>

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

        <div className="message-thread">
          {activeSession.messages.length === 0 && (
            <div className="prompt-grid">
              {quickActions.map((action) => (
                <button
                  className="prompt-card"
                  key={action.title}
                  onClick={() => setInput(action.prompt)}
                  type="button"
                >
                  <Sparkles size={18} />
                  <strong>{action.title}</strong>
                  <span>{action.prompt}</span>
                </button>
              ))}
            </div>
          )}

          {activeSession.messages.map((message) => (
            <article className={`message-row ${message.role}`} key={message.id}>
              <div className="avatar">
                {message.role === "assistant" ? <Bot size={18} /> : <UserRound size={17} />}
              </div>
              <div className="message-bubble">
                <header>
                  <strong>{message.author}</strong>
                  <span>{message.time}</span>
                  {message.model && <em>{message.model}</em>}
                </header>
                <p>{message.content}</p>
                {message.citations && (
                  <div className="citation-list">
                    {message.citations.map((citation) => (
                      <button key={citation} type="button">
                        <FileText size={14} />
                        {citation}
                      </button>
                    ))}
                  </div>
                )}
                {message.role === "assistant" && (
                  <div className="message-actions">
                    <button title="复制" type="button"><Copy size={14} /></button>
                    <button title="重新生成" type="button"><RefreshCw size={14} /></button>
                    <button title="有帮助" type="button"><ThumbsUp size={14} /></button>
                    <button title="无帮助" type="button"><ThumbsDown size={14} /></button>
                    {message.tokens && <span>{message.tokens} tokens</span>}
                  </div>
                )}
              </div>
            </article>
          ))}

          {isGenerating && (
            <div className="generating-line">
              <span />
              <strong>正在生成响应</strong>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="composer-panel">
          <div className="composer-tools">
            <button className="icon-button" title="添加附件" type="button">
              <Paperclip size={17} />
            </button>
            <button className="tool-chip active" type="button">
              <Database size={15} />
              售后工单库
            </button>
            <button className="tool-chip" type="button">
              <ShieldCheck size={15} />
              权限检查
            </button>
          </div>
          <textarea
            aria-label="输入问题"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            value={input}
          />
          <footer>
            <span>Top-K 8 · 温度 0.4 · 引用溯源开启</span>
            <button className="send-button" disabled={!input.trim() || isGenerating} onClick={handleSend} type="button">
              <Send size={17} />
              发送
            </button>
          </footer>
        </div>
      </section>

      <aside className="context-panel">
        <section className="side-section">
          <header>
            <span className="eyebrow">Runtime</span>
            <h3>响应编排</h3>
          </header>
          <div className="pipeline-list">
            {pipeline.map((item) => (
              <div className="pipeline-step" data-tone={item.tone} key={item.label}>
                <span />
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="side-section">
          <header>
            <span className="eyebrow">Routing</span>
            <h3>模型路由</h3>
          </header>
          <div className="route-list">
            <div><Cpu size={16} /><span>主模型</span><strong>GPT-4.1</strong></div>
            <div><Database size={16} /><span>向量模型</span><strong>text-embedding-3-large</strong></div>
            <div><Workflow size={16} /><span>重排模型</span><strong>bge-reranker-v2</strong></div>
          </div>
        </section>

        <section className="side-section audit-ok">
          <Zap size={18} />
          <span>
            <strong>审计链路已记录</strong>
            <small>请求、检索、引用和权限策略完整留痕</small>
          </span>
        </section>
      </aside>
    </div>
  );
}
