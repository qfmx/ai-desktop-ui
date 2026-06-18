import { Filter, Grid3X3, List, RefreshCw, Search, Upload } from "lucide-react";

interface KnowledgeToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}

export function KnowledgeToolbar({
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
}: KnowledgeToolbarProps) {
  return (
    <section className="page-toolbar">
      <label className="local-search">
        <Search size={17} />
        <input
          aria-label="搜索知识库"
          onChange={(event) => onQueryChange(event.target.value)}
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
          <button
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => onViewModeChange("grid")}
            title="网格"
            type="button"
          >
            <Grid3X3 size={16} />
          </button>
          <button
            className={viewMode === "list" ? "active" : ""}
            onClick={() => onViewModeChange("list")}
            title="列表"
            type="button"
          >
            <List size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
