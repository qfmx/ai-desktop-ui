import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { HistoryItem } from "../types/history";

import { HistoryToolbar } from "../components/history/HistoryToolbar";
import { HistoryFilter, type ArchiveFilter } from "../components/history/HistoryFilter";
import { HistoryList } from "../components/history/HistoryList";

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

interface HistoryPageProps {
  onOpenSession: (id: string) => void;
}

export default function HistoryPage({ onOpenSession }: HistoryPageProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
    () => Array.from(new Set(items.flatMap((item) => item.tags))),
    [items],
  );

  useEffect(() => {
    setSelectedTags((current) => current.filter((tag) => tags.includes(tag)));
  }, [tags]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchedArchive =
        archiveFilter === "all" ||
        (archiveFilter === "archived" ? item.archived : !item.archived);
      const matchedTags =
        selectedTags.length === 0 || selectedTags.some((tag) => item.tags.includes(tag));
      const matchedQuery =
        !query ||
        [item.title, item.preview, item.model, item.scope, ...item.tags]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());
      return matchedArchive && matchedTags && matchedQuery;
    });
  }, [archiveFilter, items, query, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

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

  const renameItem = async (id: string, title: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title } : item)),
    );
    try {
      await api.chat.update(id, { title });
    } catch (error) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, title: current.title } : item)),
      );
      throw error;
    }
  };

  const updateItemTags = async (id: string, tags: string[]) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, tags } : item)),
    );
    try {
      await api.chat.update(id, { tags });
    } catch (error) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, tags: current.tags } : item)),
      );
      throw error;
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
        selectedTags={selectedTags}
        archiveFilter={archiveFilter}
        onTagToggle={toggleTag}
        onClearTags={clearTags}
        onArchiveFilterChange={setArchiveFilter}
      />
      <HistoryList
        items={filteredItems}
        toggleStar={toggleStar}
        toggleArchive={toggleArchive}
        renameItem={renameItem}
        updateItemTags={updateItemTags}
        deleteItem={deleteItem}
        onOpenSession={onOpenSession}
      />
    </div>
  );
}
