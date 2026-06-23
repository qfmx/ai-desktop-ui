import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { HistoryItem } from "../types/history";

import { HistoryToolbar } from "../components/history/HistoryToolbar";
import { HistoryFilter, type ArchiveFilter } from "../components/history/HistoryFilter";
import { HistoryList } from "../components/history/HistoryList";

const ALL_TAG = "全部";

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState(ALL_TAG);
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("all");
  const [backendOk, setBackendOk] = useState(false);

  useEffect(() => {
    api.health()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  const loadSessions = useCallback(() => {
    if (!backendOk) return;
    api.chat.sessions({ include_archived: true }).then((list) => {
      setItems(
        list.map((session: any) => ({
          id: session.id,
          title: session.title,
          model: session.model || "-",
          scope: session.scope || "-",
          messageCount: session.message_count ?? 0,
          tokenUsage: session.token_usage ?? 0,
          lastActive: session.updated_at || session.created_at || "",
          starred: Boolean(session.starred),
          archived: Boolean(session.archived),
          archivedAt: session.archived_at || "",
          tags: parseTags(session.tags),
          preview: session.preview || "",
        })),
      );
    });
  }, [backendOk]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const tags = useMemo(
    () => [ALL_TAG, ...Array.from(new Set(items.flatMap((item) => item.tags)))],
    [items],
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchedArchive =
        archiveFilter === "all" ||
        (archiveFilter === "archived" ? item.archived : !item.archived);
      const matchedTag = activeTag === ALL_TAG || item.tags.includes(activeTag);
      const matchedQuery =
        !query ||
        [item.title, item.preview, item.model, item.scope, ...item.tags]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());
      return matchedArchive && matchedTag && matchedQuery;
    });
  }, [activeTag, archiveFilter, items, query]);

  const toggleStar = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const nextStarred = !current.starred;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, starred: nextStarred } : item)),
    );
    try {
      await api.chat.update(id, { starred: nextStarred });
    } catch {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, starred: current.starred } : item)),
      );
    }
  };

  const toggleArchive = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const nextArchived = !current.archived;
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              archived: nextArchived,
              archivedAt: nextArchived ? new Date().toLocaleString() : "",
            }
          : item,
      ),
    );
    try {
      await api.chat.update(id, { archived: nextArchived });
    } catch {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, archived: current.archived, archivedAt: current.archivedAt }
            : item,
        ),
      );
    }
  };

  const deleteItem = async (id: string) => {
    await api.chat.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (!backendOk) {
    return (
      <div
        className="workspace-page"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
      >
        <p style={{ opacity: 0.6 }}>正在连接后端服务...</p>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <HistoryToolbar query={query} onQueryChange={setQuery} />
      <HistoryFilter
        tags={tags}
        activeTag={activeTag}
        archiveFilter={archiveFilter}
        onTagChange={setActiveTag}
        onArchiveFilterChange={setArchiveFilter}
      />
      <HistoryList
        items={filteredItems}
        toggleStar={toggleStar}
        toggleArchive={toggleArchive}
        deleteItem={deleteItem}
      />
    </div>
  );
}
