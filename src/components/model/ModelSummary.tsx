import { Activity, Cpu, Gauge, Server } from "lucide-react";

interface ModelSummaryProps {
  providersCount: number;
  activeModelsCount: number;
  allModelsCount: number;
  availability: number;
}

export function ModelSummary({
  providersCount,
  activeModelsCount,
  allModelsCount,
  availability,
}: ModelSummaryProps) {
  return (
    <section className="summary-grid">
      <article className="summary-card" data-tone="cyan">
        <Server size={20} />
        <span>供应商</span>
        <strong>{providersCount}</strong>
      </article>
      <article className="summary-card" data-tone="green">
        <Cpu size={20} />
        <span>可用模型</span>
        <strong>{allModelsCount}</strong>
      </article>
      <article className="summary-card" data-tone="amber">
        <Activity size={20} />
        <span>已启用</span>
        <strong>{activeModelsCount}</strong>
      </article>
      <article className="summary-card" data-tone="rose">
        <Gauge size={20} />
        <span>平均可用率</span>
        <strong>{availability.toFixed(1)}%</strong>
      </article>
    </section>
  );
}
