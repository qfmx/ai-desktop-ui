import { useMemo, useState } from "react";
import {
  Archive,
  Clock,
  Download,
  MessageSquare,
  Search,
  Star,
  Trash2,
} from "lucide-react";

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

const initialHistory: HistoryItem[] = [
  {
    id: "1",
    title: "交付延期风险归因",
    model: "GPT-4.1",
    scope: "售后工单库",
    messageCount: 18,
    tokenUsage: 12640,
    lastActive: "今天 10:30",
    starred: true,
    tags: ["运营", "工单"],
    preview: "归纳上周客户反馈中的交付延期原因，并引用对应工单与处理建议。",
  },
  {
    id: "2",
    title: "合同风险条款识别",
    model: "Claude 3.5 Sonnet",
    scope: "法务合同库",
    messageCount: 12,
    tokenUsage: 9840,
    lastActive: "昨天 16:12",
    starred: false,
    tags: ["法务", "合同"],
    preview: "检查采购合同中的交付、违约和数据安全条款。",
  },
  {
    id: "3",
    title: "季度经营会纪要",
    model: "GPT-4.1",
    scope: "会议纪要库",
    messageCount: 24,
    tokenUsage: 18820,
    lastActive: "周一 09:20",
    starred: true,
    tags: ["经营", "纪要"],
    preview: "从会议录音和资料中整理季度经营会要点与行动项。",
  },
  {
    id: "4",
    title: "采购流程制度问答",
    model: "GPT-4o mini",
    scope: "企业制度与流程",
    messageCount: 9,
    tokenUsage: 4260,
    lastActive: "2026-06-12",
    starred: false,
    tags: ["制度", "采购"],
    preview: "解释采购申请、比价、审批和归档流程中的关键节点。",
  },
];

export default function HistoryPage() {
  const [items, setItems] = useState(initialHistory);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("全部");

  const tags = useMemo(() => ["全部", ...Array.from(new Set(items.flatMap((item) => item.tags)))], [items]);
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

  const toggleStar = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, starred: !item.starred } : item)),
    );
  };

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
                <span><Clock size={12} />{item.lastActive}</span>
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
              <button title="归档" type="button"><Archive size={15} /></button>
              <button title="删除" type="button"><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
