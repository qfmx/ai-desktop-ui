import { useEffect, useState } from "react";
import {
  Archive,
  Check,
  Edit3,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import type { ChatSession } from "../../types/chat";

interface SessionListProps {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewSession: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onUpdateTags: (id: string, tags: string[]) => Promise<void>;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
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

export function SessionList({
  sessions,
  activeId,
  onSelect,
  onNewSession,
  onRename,
  onUpdateTags,
  onArchive,
  onDelete,
}: SessionListProps) {
  const [openMenuId, setOpenMenuId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingMode, setEditingMode] = useState<"rename" | "tags" | "">("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [savingId, setSavingId] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (editingId && !sessions.some((session) => session.id === editingId)) {
      closeEditor();
    }
  }, [editingId, sessions]);

  const closeEditor = () => {
    setEditingId("");
    setEditingMode("");
    setDraftTitle("");
    setDraftTags([]);
    setTagInput("");
    setSavingId("");
    setEditError("");
    setOpenMenuId("");
  };

  const startRename = (session: ChatSession) => {
    setEditingId(session.id);
    setEditingMode("rename");
    setDraftTitle(session.title);
    setDraftTags([]);
    setTagInput("");
    setEditError("");
    setOpenMenuId("");
  };

  const startTagEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditingMode("tags");
    setDraftTitle("");
    setDraftTags(normalizeTags(session.tags ?? []));
    setTagInput("");
    setEditError("");
    setOpenMenuId("");
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

  const submitRename = async (session: ChatSession) => {
    const title = normalizeTitle(draftTitle);
    if (!title) {
      setEditError("标题不能为空");
      return;
    }
    if (title === session.title) {
      closeEditor();
      return;
    }
    setSavingId(session.id);
    setEditError("");
    try {
      await onRename(session.id, title);
      closeEditor();
    } catch {
      setSavingId("");
      setEditError("重命名失败，请稍后重试");
    }
  };

  const submitTags = async (session: ChatSession) => {
    const tags = normalizeTags([...draftTags, tagInput]);
    setSavingId(session.id);
    setEditError("");
    try {
      await onUpdateTags(session.id, tags);
      closeEditor();
    } catch {
      setSavingId("");
      setEditError("标签保存失败，请稍后重试");
    }
  };

  return (
    <aside className="session-panel">
      <button className="primary-action" onClick={onNewSession} type="button">
        <MessageSquare size={17} /> 新建会话
      </button>
      <div className="session-list">
        {sessions.map((session) => {
          const isSaving = savingId === session.id;
          const isRenameEditing = editingId === session.id && editingMode === "rename";
          const isTagEditing = editingId === session.id && editingMode === "tags";

          return (
            <article
              className={`session-card ${session.id === activeId ? "active" : ""}`}
              key={session.id}
            >
              <button
                className="session-card-body"
                disabled={isRenameEditing || isTagEditing}
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
                  disabled={isSaving}
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
                    <button onClick={() => startRename(session)} type="button">
                      <Edit3 size={14} />
                      重命名
                    </button>
                    <button onClick={() => startTagEdit(session)} type="button">
                      <Tags size={14} />
                      编辑标签
                    </button>
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

              {isRenameEditing && (
                <form
                  className="session-edit-panel"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitRename(session);
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
                  <div className="session-edit-actions">
                    <button disabled={isSaving} title="保存" type="submit">
                      <Check size={14} />
                    </button>
                    <button disabled={isSaving} onClick={closeEditor} title="取消" type="button">
                      <X size={14} />
                    </button>
                  </div>
                  {editError && <p className="session-edit-error">{editError}</p>}
                </form>
              )}

              {isTagEditing && (
                <form
                  className="session-edit-panel session-tag-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitTags(session);
                  }}
                >
                  <div className="session-tag-input-row">
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
                    <div className="session-tag-drafts" aria-label="待保存标签">
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
                  <div className="session-edit-actions">
                    <button disabled={isSaving} title="保存" type="submit">
                      <Check size={14} />
                    </button>
                    <button disabled={isSaving} onClick={closeEditor} title="取消" type="button">
                      <X size={14} />
                    </button>
                  </div>
                  {editError && <p className="session-edit-error">{editError}</p>}
                </form>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
