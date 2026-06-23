import { useEffect, useState } from "react";
import {
  Archive,
  Check,
  Clock,
  Edit3,
  MessageSquare,
  Plus,
  Star,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import type { HistoryItem } from "../../types/history";

interface HistoryListProps {
  items: HistoryItem[];
  toggleStar: (id: string) => void;
  toggleArchive: (id: string) => void;
  renameItem: (id: string, title: string) => Promise<void>;
  updateItemTags: (id: string, tags: string[]) => Promise<void>;
  deleteItem: (id: string) => void;
  onOpenSession: (id: string) => void;
}

function normalizeTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 32);
}

function normalizeTag(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 16);
}

function normalizeTags(values: string[]) {
  const seen = new Set<string>();
  const tags: string[] = [];
  values
    .flatMap((value) => value.split(/[,，]/))
    .map(normalizeTag)
    .forEach((tag) => {
      if (!tag || seen.has(tag) || tags.length >= 6) return;
      seen.add(tag);
      tags.push(tag);
    });
  return tags;
}

export function HistoryList({
  items,
  toggleStar,
  toggleArchive,
  renameItem,
  updateItemTags,
  deleteItem,
  onOpenSession,
}: HistoryListProps) {
  const [editingId, setEditingId] = useState("");
  const [editingMode, setEditingMode] = useState<"rename" | "tags" | "">("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [savingId, setSavingId] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (editingId && !items.some((item) => item.id === editingId)) {
      closeEditor();
    }
  }, [editingId, items]);

  const closeEditor = () => {
    setEditingId("");
    setEditingMode("");
    setDraftTitle("");
    setDraftTags([]);
    setTagInput("");
    setSavingId("");
    setEditError("");
  };

  const startRename = (item: HistoryItem) => {
    setEditingId(item.id);
    setEditingMode("rename");
    setDraftTitle(item.title);
    setDraftTags([]);
    setTagInput("");
    setEditError("");
  };

  const startTagEdit = (item: HistoryItem) => {
    setEditingId(item.id);
    setEditingMode("tags");
    setDraftTitle("");
    setDraftTags(normalizeTags(item.tags));
    setTagInput("");
    setEditError("");
  };

  const addDraftTags = (value = tagInput) => {
    const nextTags = normalizeTags([...draftTags, value]);
    setDraftTags(nextTags);
    setTagInput("");
    setEditError("");
  };

  const removeDraftTag = (tag: string) => {
    setDraftTags((current) => current.filter((item) => item !== tag));
    setEditError("");
  };

  const submitRename = async (item: HistoryItem) => {
    const title = normalizeTitle(draftTitle);
    if (!title) {
      setEditError("标题不能为空");
      return;
    }
    if (title === item.title) {
      closeEditor();
      return;
    }
    setSavingId(item.id);
    setEditError("");
    try {
      await renameItem(item.id, title);
      closeEditor();
    } catch {
      setSavingId("");
      setEditError("重命名失败，请稍后重试");
    }
  };

  const submitTags = async (item: HistoryItem) => {
    const tags = normalizeTags([...draftTags, tagInput]);
    setSavingId(item.id);
    setEditError("");
    try {
      await updateItemTags(item.id, tags);
      closeEditor();
    } catch {
      setSavingId("");
      setEditError("标签保存失败，请稍后重试");
    }
  };

  const openSession = (item: HistoryItem, target: EventTarget | null) => {
    if (editingId === item.id) return;
    if (target instanceof HTMLElement && target.closest("button, input, form")) return;
    onOpenSession(item.id);
  };

  return (
    <section className="history-list">
      {items.map((item) => {
        const isSaving = savingId === item.id;
        const isRenameEditing = editingId === item.id && editingMode === "rename";
        const isTagEditing = editingId === item.id && editingMode === "tags";

        return (
          <article
            className={`history-row ${item.archived ? "archived" : ""}`}
            key={item.id}
            onDoubleClick={(event) => openSession(item, event.target)}
            title="双击查看聊天记录"
          >
            <button
              className={`star-button ${item.starred ? "active" : ""}`}
              disabled={isSaving}
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

              {isRenameEditing && (
                <form
                  className="history-edit-panel"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitRename(item);
                  }}
                >
                  <input
                    autoFocus
                    disabled={isSaving}
                    maxLength={32}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") closeEditor();
                    }}
                    value={draftTitle}
                  />
                  <div className="history-edit-actions">
                    <button disabled={isSaving} title="保存" type="submit">
                      <Check size={14} />
                    </button>
                    <button disabled={isSaving} onClick={closeEditor} title="取消" type="button">
                      <X size={14} />
                    </button>
                  </div>
                  {editError && <p className="history-edit-error">{editError}</p>}
                </form>
              )}

              {isTagEditing && (
                <form
                  className="history-edit-panel history-tag-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitTags(item);
                  }}
                >
                  <div className="history-tag-input-row">
                    <input
                      autoFocus
                      disabled={isSaving}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          closeEditor();
                          return;
                        }
                        if (event.key === "Enter" || event.key === "," || event.key === "，") {
                          event.preventDefault();
                          addDraftTags();
                        }
                        if (event.key === "Backspace" && !tagInput) {
                          setDraftTags((current) => current.slice(0, -1));
                        }
                      }}
                      placeholder="输入标签后按 Enter"
                      value={tagInput}
                    />
                    <button
                      disabled={isSaving || !normalizeTag(tagInput)}
                      onClick={() => addDraftTags()}
                      title="添加标签"
                      type="button"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {draftTags.length > 0 && (
                    <div className="history-tag-drafts" aria-label="待保存标签">
                      {draftTags.map((tag) => (
                        <button
                          disabled={isSaving}
                          key={tag}
                          onClick={() => removeDraftTag(tag)}
                          title={`移除 ${tag}`}
                          type="button"
                        >
                          {tag}
                          <X size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="history-edit-actions">
                    <button disabled={isSaving} title="保存" type="submit">
                      <Check size={14} />
                    </button>
                    <button disabled={isSaving} onClick={closeEditor} title="取消" type="button">
                      <X size={14} />
                    </button>
                  </div>
                  {editError && <p className="history-edit-error">{editError}</p>}
                </form>
              )}
            </div>
            <div className="history-tags">
              {item.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="history-actions">
              <button
                disabled={isSaving}
                onClick={() => startRename(item)}
                title="重命名"
                type="button"
              >
                <Edit3 size={15} />
              </button>
              <button
                disabled={isSaving}
                onClick={() => startTagEdit(item)}
                title="编辑标签"
                type="button"
              >
                <Tags size={15} />
              </button>
              <button
                className={item.archived ? "active" : ""}
                disabled={isSaving}
                onClick={() => toggleArchive(item.id)}
                title={item.archived ? "取消归档" : "归档"}
                type="button"
              >
                <Archive size={15} />
              </button>
              <button
                disabled={isSaving}
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
        );
      })}
    </section>
  );
}
