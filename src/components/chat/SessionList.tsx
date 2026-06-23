import { useState } from "react";
import {
  Archive,
  MessageSquare,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import type { ChatSession } from "../../types/chat";

interface SessionListProps {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewSession: () => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SessionList({
  sessions,
  activeId,
  onSelect,
  onNewSession,
  onArchive,
  onDelete,
}: SessionListProps) {
  const [openMenuId, setOpenMenuId] = useState("");

  return (
    <aside className="session-panel">
      <button className="primary-action" onClick={onNewSession} type="button">
        <MessageSquare size={17} /> 新建会话
      </button>
      <div className="session-list">
        {sessions.map((session) => (
          <article
            className={`session-card ${session.id === activeId ? "active" : ""}`}
            key={session.id}
          >
            <button
              className="session-card-body"
              onClick={() => onSelect(session.id)}
              type="button"
            >
              <strong>{session.title}</strong>
              <span>{session.scope || "默认知识库"}</span>
              <small>
                {session.model || "未选择模型"} · {session.messages.length} 条消息
              </small>
              {(session.tags ?? []).length > 0 && (
                <div className="session-tags" aria-label="会话标签">
                  {(session.tags ?? []).slice(0, 2).map((tag) => (
                    <span className="session-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                  {(session.tags ?? []).length > 2 && (
                    <span className="session-tag">+{(session.tags ?? []).length - 2}</span>
                  )}
                </div>
              )}
            </button>

            <div className="session-card-actions">
              <button
                className="session-more"
                onClick={() =>
                  setOpenMenuId((current) => (current === session.id ? "" : session.id))
                }
                title="更多操作"
                type="button"
              >
                <MoreHorizontal size={16} />
              </button>
              {openMenuId === session.id && (
                <div className="session-menu">
                  <button
                    onClick={() => {
                      setOpenMenuId("");
                      onArchive(session.id);
                    }}
                    type="button"
                  >
                    <Archive size={14} />
                    归档
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      setOpenMenuId("");
                      if (window.confirm(`删除会话「${session.title}」？`)) {
                        onDelete(session.id);
                      }
                    }}
                    type="button"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
