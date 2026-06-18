import { Database, FileText, Layers3, ShieldCheck } from "lucide-react";
import type { KnowledgeBase, KnowledgeStats } from "../../types/knowledge";

interface KnowledgeSummaryProps {
  bases: KnowledgeBase[];
  stats: KnowledgeStats | null;
  policyCount: number;
}

export function KnowledgeSummary({ bases, stats, policyCount }: KnowledgeSummaryProps) {
  const totalDocuments = stats?.documents ?? bases.reduce((sum, base) => sum + base.documents, 0);
  const totalChunks = stats?.chunks ?? bases.reduce((sum, base) => sum + base.chunks, 0);

  return (
    <section className="summary-grid">
      <article className="summary-card" data-tone="cyan">
        <Database size={20} />
        <span>知识库总数</span>
        <strong>{stats?.bases ?? bases.length}</strong>
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
        <strong>{policyCount}</strong>
      </article>
    </section>
  );
}
