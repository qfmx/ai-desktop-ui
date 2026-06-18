import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Database,
  FileText,
  Filter,
  Grid3X3,
  Layers3,
  List,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { api } from "../services/api";

type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  documents: number;
  chunks: number;
  size: string;
  status: "ready" | "syncing" | "warning";
  owner: string;
  updatedAt: string;
  embedding: string;
  health: number;
  tags: string[];
};

const statusMap: Record<string, string> = {
  ready: "可用",
  syncing: "同步中",
  warning: "需复核",
};

export default function KnowledgePage() {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState("");
  const [backendOk, setBackendOk] = useState(false);

  useEffect(() => {
    api.health()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  useEffect(() => {
    if (!backendOk) return;
    api.knowledge.bases().then((list) => {
      setBases(
        list.map((b: any) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          documents: b.documents ?? 0,
          chunks: 0,
          size: "—",
          status: b.status || "ready",
          owner: b.owner || "",
          updatedAt: b.updated_at || "",
          embedding: b.embedding_model || "",
          health: b.status === "ready" ? 94 : b.status === "syncing" ? 86 : 72,
          tags: typeof b.tags === "string" ? JSON.parse(b.tags) : b.tags || [],
        }))
      );
      if (list.length > 0) setSelectedId(list[0].id);
    });
  }, [backendOk]);

  const filteredBases = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return bases;
    return bases.filter((base) =>
      [base.name, base.description, base.owner, ...base.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [query, bases]);

  const totalDocuments = bases.reduce((sum, base) => sum + base.documents, 0);

  if (!backendOk) {
    return (
      <div className="workspace-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <p style={{ opacity: 0.6 }}>正在连接后端服务...</p>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <section className="summary-grid">
        <article className="summary-card" data-tone="cyan">
          <Database size={20} />
          <span>知识库总数</span>
          <strong>{bases.length}</strong>
        </article>
        <article className="summary-card" data-tone="green">
          <FileText size={20} />
          <span>文档总量</span>
          <strong>{totalDocuments.toLocaleString()}</strong>
        </article>
        <article className="summary-card" data-tone="amber">
          <Layers3 size={20} />
          <span>切片总量</span>
          <strong>—</strong>
        </article>
        <article className="summary-card" data-tone="rose">
          <ShieldCheck size={20} />
          <span>权限策略</span>
          <strong>12</strong>
        </article>
      </section>

      <section className="page-toolbar">
        <label className="local-search">
          <Search size={17} />
          <input
            aria-label="搜索知识库"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索知识库、标签、负责人"
            value={query}
          />
        </label>
        <div className="toolbar-buttons">
          <button className="secondary-action" type="button">
            <Filter size={16} /> 筛选
          </button>
          <button className="secondary-action" type="button">
            <RefreshCw size={16} /> 重建索引
          </button>
          <button className="primary-action compact" type="button">
            <Upload size={16} /> 上传文档
          </button>
          <div className="view-toggle">
            <button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")} title="网格" type="button">
              <Grid3X3 size={16} />
            </button>
            <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")} title="列表" type="button">
              <List size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className={viewMode === "grid" ? "knowledge-grid" : "knowledge-list"}>
        {filteredBases.map((base) => (
          <article
            className={`knowledge-card ${selectedId === base.id ? "selected" : ""}`}
            key={base.id}
            onClick={() => setSelectedId(base.id)}
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
              <span>— 切片</span>
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

      <section className="permission-matrix">
        <header className="section-title">
          <div>
            <span className="eyebrow">Access</span>
            <h2>权限矩阵</h2>
          </div>
          <CheckCircle2 size={19} />
        </header>
        <div className="matrix-table">
          <div className="matrix-row head">
            <span>知识库</span>
            <span>负责人</span>
            <span>可访问角色</span>
            <span>策略</span>
          </div>
          {filteredBases.slice(0, 3).map((base) => (
            <div className="matrix-row" key={base.id}>
              <span>{base.name}</span>
              <span>{base.owner}</span>
              <span>{base.owner} · 管理层</span>
              <strong>全员可读</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
