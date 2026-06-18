import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { HistoryItem } from "../types/history";

import { HistoryToolbar } from "../components/history/HistoryToolbar";
import { HistoryFilter } from "../components/history/HistoryFilter";
import { HistoryList } from "../components/history/HistoryList";

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
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const nextStarred = !current.starred;
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, starred: nextStarred } : item
      )
    );
    try {
      await api.chat.update(id, { starred: nextStarred });
    } catch {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, starred: current.starred } : item
        )
      );
    }
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
      <HistoryToolbar query={query} onQueryChange={setQuery} />
      <HistoryFilter tags={tags} activeTag={activeTag} onTagChange={setActiveTag} />
      <HistoryList items={filteredItems} toggleStar={toggleStar} deleteItem={deleteItem} />
    </div>
  );
}
