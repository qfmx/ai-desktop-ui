import { Database } from "lucide-react";
import { type KnowledgeBase, statusMap } from "../../types/knowledge";

interface KnowledgeListProps {
  bases: KnowledgeBase[];
  selectedId: string;
  onSelect: (id: string) => void;
  viewMode: "grid" | "list";
}

export function KnowledgeList({ bases, selectedId, onSelect, viewMode }: KnowledgeListProps) {
  return (
    <section className={viewMode === "grid" ? "knowledge-grid" : "knowledge-list"}>
      {bases.map((base) => (
        <article
          className={`knowledge-card ${selectedId === base.id ? "selected" : ""}`}
          key={base.id}
          onClick={() => onSelect(base.id)}
        >
          <header>
            <div className="knowledge-icon">
              <Database size={20} />
            </div>
            <span className={`status-badge ${base.status}`}>{statusMap[base.status]}</span>
          </header>
          <h2>{base.name}</h2>
          <p>{base.description}</p>
          <div className="tag-row">
            {base.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="knowledge-meta">
            <span>{base.documents.toLocaleString()} 文档</span>
            <span>{base.chunks.toLocaleString()} 切片</span>
            <span>{base.size}</span>
          </div>
          <div className="health-row">
            <span>健康度</span>
            <strong>{base.health}%</strong>
            <div>
              <i style={{ width: `${base.health}%` }} />
            </div>
          </div>
          <footer>
            <span>{base.embedding}</span>
            <small>{base.updatedAt}</small>
          </footer>
        </article>
      ))}
    </section>
  );
}
