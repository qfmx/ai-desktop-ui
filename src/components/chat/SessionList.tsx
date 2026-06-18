import { MessageSquare } from "lucide-react";
import type { ChatSession } from "../../types/chat";

interface SessionListProps {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewSession: () => void;
}

export function SessionList({ sessions, activeId, onSelect, onNewSession }: SessionListProps) {
  return (
    <aside className="session-panel">
      <button className="primary-action" onClick={onNewSession} type="button">
        <MessageSquare size={17} /> 新建会话
      </button>
      <div className="session-list">
        {sessions.map((session) => (
          <button
            className={`session-card ${session.id === activeId ? "active" : ""}`}
            key={session.id}
            onClick={() => onSelect(session.id)}
            type="button"
          >
            <strong>{session.title}</strong>
            <span>{session.scope}</span>
            <small>
              {session.model} · {session.messages.length} 条消息
            </small>
          </button>
        ))}
      </div>
    </aside>
  );
}
