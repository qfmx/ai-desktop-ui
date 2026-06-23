import {
  Bot,
  Copy,
  FileText,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import type { Message, QuickAction } from "../../types/chat";
import { MarkdownContent } from "./MarkdownContent";

interface MessageThreadProps {
  messages: Message[];
  isGenerating: boolean;
  streamingText: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  quickActions: QuickAction[];
  onQuickAction: (prompt: string) => void;
}

export function MessageThread({
  messages,
  isGenerating,
  streamingText,
  messagesEndRef,
  quickActions,
  onQuickAction,
}: MessageThreadProps) {
  return (
    <div className="message-thread">
      {messages.length === 0 && !isGenerating && (
        <div className="prompt-grid">
          {quickActions.map((action) => (
            <button
              className="prompt-card"
              key={action.title}
              onClick={() => onQuickAction(action.prompt)}
              type="button"
            >
              <Sparkles size={18} />
              <strong>{action.title}</strong>
              <span>{action.prompt}</span>
            </button>
          ))}
        </div>
      )}

      {messages.map((message) => (
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
            <MarkdownContent content={message.content} />
            {message.citations && message.citations.length > 0 && (
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
                <button title="复制" type="button">
                  <Copy size={14} />
                </button>
                <button title="重新生成" type="button">
                  <RefreshCw size={14} />
                </button>
                <button title="有帮助" type="button">
                  <ThumbsUp size={14} />
                </button>
                <button title="无帮助" type="button">
                  <ThumbsDown size={14} />
                </button>
                {message.tokens && <span>{message.tokens} tokens</span>}
              </div>
            )}
          </div>
        </article>
      ))}

      {isGenerating && streamingText && (
        <article className="message-row assistant">
          <div className="avatar">
            <Bot size={18} />
          </div>
          <div className="message-bubble">
            <header>
              <strong>Enterprise AI</strong>
              <span>现在</span>
            </header>
            <MarkdownContent content={streamingText} />
          </div>
        </article>
      )}

      {isGenerating && !streamingText && (
        <div className="generating-line">
          <span />
          <strong>正在生成响应</strong>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
