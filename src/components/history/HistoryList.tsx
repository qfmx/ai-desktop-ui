import { Archive, Clock, MessageSquare, Star, Trash2 } from "lucide-react";
import type { HistoryItem } from "../../types/history";

interface HistoryListProps {
  items: HistoryItem[];
  toggleStar: (id: string) => void;
  toggleArchive: (id: string) => void;
  deleteItem: (id: string) => void;
}

export function HistoryList({ items, toggleStar, toggleArchive, deleteItem }: HistoryListProps) {
  return (
    <section className="history-list">
      {items.map((item) => (
        <article className={`history-row ${item.archived ? "archived" : ""}`} key={item.id}>
          <button
            className={`star-button ${item.starred ? "active" : ""}`}
            onClick={() => toggleStar(item.id)}
            title={item.starred ? "取消收藏" : "收藏"}
            type="button"
          >
            <Star size={16} fill={item.starred ? "currentColor" : "none"} />
          </button>
          <div className="history-icon">
            <MessageSquare size={19} />
          </div>
          <div className="history-content">
            <div className="history-title-row">
              <h2>{item.title}</h2>
              {item.archived && <span className="history-status-badge">已归档</span>}
            </div>
            <p>{item.preview}</p>
            <div className="history-meta">
              <span>{item.model}</span>
              <span>{item.scope}</span>
              <span>
                <Clock size={12} />
                {item.lastActive}
              </span>
              <span>{item.messageCount} 条</span>
              <span>{item.tokenUsage.toLocaleString()} tokens</span>
            </div>
          </div>
          <div className="history-tags">
            {item.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="history-actions">
            <button
              className={item.archived ? "active" : ""}
              onClick={() => toggleArchive(item.id)}
              title={item.archived ? "取消归档" : "归档"}
              type="button"
            >
              <Archive size={15} />
            </button>
            <button
              title="删除"
              type="button"
              onClick={() => {
                if (window.confirm(`删除历史会话「${item.title}」？`)) {
                  deleteItem(item.id);
                }
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
