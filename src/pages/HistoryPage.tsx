import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Clock,
  Download,
  MessageSquare,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { api } from "../services/api";

type HistoryItem = {
  id: string;
  title: string;
  model: string;
  scope: string;
  messageCount: number;
  tokenUsage: number;
  lastActive: string;
  starred: boolean;
  tags: string[];
  preview: string;
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("全部");
  const [backendOk, setBackendOk] = useState(false);

  useEffect(() => {
    api.health()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  const loadSessions = useCallback(() => {
    if (!backendOk) return;
    api.chat.sessions().then((list) => {
      setItems(
        list.map((s: any) => ({
          id: s.id,
          title: s.title,
          model: s.model || "—",
          scope: s.scope || "—",
          messageCount: s.message_count ?? 0,
          tokenUsage: s.token_usage ?? 0,
          lastActive: s.updated_at || s.created_at || "",
          starred: Boolean(s.starred),
          tags: typeof s.tags === "string" ? JSON.parse(s.tags) : s.tags || [],
          preview: s.preview || "",
        }))
      );
    });
  }, [backendOk]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const tags = useMemo(
    () => ["全部", ...Array.from(new Set(items.flatMap((item) => item.tags)))],
    [items]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchedTag = activeTag === "全部" || item.tags.includes(activeTag);
      const matchedQuery =
        !query ||
        [item.title, item.preview, item.model, item.scope, ...item.tags]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());
      return matchedTag && matchedQuery;
    });
  }, [activeTag, items, query]);

  const toggleStar = async (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, starred: !item.starred } : item
      )
    );
  };

  const deleteItem = async (id: string) => {
    await api.chat.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (!backendOk) {
    return (
      <div className="workspace-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <p style={{ opacity: 0.6 }}>正在连接后端服务...</p>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <section className="page-toolbar">
        <label className="local-search">
          <Search size={17} />
          <input
            aria-label="搜索对话历史"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、模型、知识库或标签"
            value={query}
          />
        </label>
        <button className="secondary-action" type="button">
          <Download size={16} />
          导出记录
        </button>
      </section>

      <section className="tag-filter-row" aria-label="历史标签">
        {tags.map((tag) => (
          <button
            className={tag === activeTag ? "active" : ""}
            key={tag}
            onClick={() => setActiveTag(tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </section>

      <section className="history-list">
        {filteredItems.map((item) => (
          <article className="history-row" key={item.id}>
            <button
              className={`star-button ${item.starred ? "active" : ""}`}
              onClick={() => toggleStar(item.id)}
              title="收藏"
              type="button"
            >
              <Star size={16} fill={item.starred ? "currentColor" : "none"} />
            </button>
            <div className="history-icon">
              <MessageSquare size={19} />
            </div>
            <div className="history-content">
              <h2>{item.title}</h2>
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
              <button title="归档" type="button">
                <Archive size={15} />
              </button>
              <button title="删除" type="button" onClick={() => deleteItem(item.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
