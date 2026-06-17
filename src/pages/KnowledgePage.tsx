import { useMemo, useState } from "react";
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

type KnowledgeStatus = "ready" | "syncing" | "warning";

type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  documents: number;
  chunks: number;
  size: string;
  status: KnowledgeStatus;
  owner: string;
  updatedAt: string;
  embedding: string;
  health: number;
  tags: string[];
};

const bases: KnowledgeBase[] = [
  {
    id: "policy",
    name: "企业制度与流程",
    description: "覆盖人事、财务、采购、行政与交付流程的内部制度文档。",
    documents: 1482,
    chunks: 42180,
    size: "3.6 GB",
    status: "syncing",
    owner: "综合管理部",
    updatedAt: "12 分钟前",
    embedding: "text-embedding-3-large",
    health: 86,
    tags: ["制度", "流程", "全员"],
  },
  {
    id: "legal",
    name: "法务合同库",
    description: "采购、销售、数据处理协议与供应商模板的结构化合同知识。",
    documents: 864,
    chunks: 21904,
    size: "1.8 GB",
    status: "ready",
    owner: "法务部",
    updatedAt: "今天 09:40",
    embedding: "bge-large-zh-v1.5",
    health: 98,
    tags: ["合同", "合规", "权限"],
  },
  {
    id: "support",
    name: "售后工单库",
    description: "客户反馈、工单处理、交付延期、区域服务质量相关数据。",
    documents: 24190,
    chunks: 183430,
    size: "12.4 GB",
    status: "ready",
    owner: "客户成功部",
    updatedAt: "今天 08:15",
    embedding: "text-embedding-3-large",
    health: 94,
    tags: ["工单", "客户", "交付"],
  },
  {
    id: "research",
    name: "行业研究资料",
    description: "市场研究、竞品分析、行业政策与技术趋势报告。",
    documents: 326,
    chunks: 12048,
    size: "5.2 GB",
    status: "warning",
    owner: "战略部",
    updatedAt: "昨天 18:20",
    embedding: "bge-m3",
    health: 72,
    tags: ["研究", "市场", "战略"],
  },
];

const statusMap: Record<KnowledgeStatus, string> = {
  ready: "可用",
  syncing: "同步中",
  warning: "需复核",
};

export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState("support");

  const filteredBases = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return bases;
    return bases.filter((base) =>
      [base.name, base.description, base.owner, ...base.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [query]);

  const totalDocuments = bases.reduce((sum, base) => sum + base.documents, 0);
  const totalChunks = bases.reduce((sum, base) => sum + base.chunks, 0);

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
          <strong>{totalChunks.toLocaleString()}</strong>
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
            <Filter size={16} />
            筛选
          </button>
          <button className="secondary-action" type="button">
            <RefreshCw size={16} />
            重建索引
          </button>
          <button className="primary-action compact" type="button">
            <Upload size={16} />
            上传文档
          </button>
          <div className="view-toggle">
            <button
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => setViewMode("grid")}
              title="网格"
              type="button"
            >
              <Grid3X3 size={16} />
            </button>
            <button
              className={viewMode === "list" ? "active" : ""}
              onClick={() => setViewMode("list")}
              title="列表"
              type="button"
            >
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
          <div className="matrix-row">
            <span>法务合同库</span>
            <span>法务部</span>
            <span>法务 · 管理层</span>
            <strong>细粒度权限</strong>
          </div>
          <div className="matrix-row">
            <span>售后工单库</span>
            <span>客户成功部</span>
            <span>售后 · 运营 · 交付</span>
            <strong>脱敏后可读</strong>
          </div>
          <div className="matrix-row">
            <span>企业制度与流程</span>
            <span>综合管理部</span>
            <span>全员</span>
            <strong>全员可读</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
