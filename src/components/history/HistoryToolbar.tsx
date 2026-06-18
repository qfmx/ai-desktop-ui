import { Download, Search } from "lucide-react";

interface HistoryToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
}

export function HistoryToolbar({ query, onQueryChange }: HistoryToolbarProps) {
  return (
    <section className="page-toolbar">
      <label className="local-search">
        <Search size={17} />
        <input
          aria-label="搜索对话历史"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索标题、模型、知识库或标签"
          value={query}
        />
      </label>
      <button className="secondary-action" type="button">
        <Download size={16} />
        导出记录
      </button>
    </section>
  );
}
