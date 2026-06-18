import { Cpu, Database, Workflow, Zap } from "lucide-react";
import type { ChatSession, RouteItem, RuntimeContext } from "../../types/chat";

interface ContextPanelProps {
  context: RuntimeContext | null;
  activeSession: ChatSession;
}

const routeIcons: Record<RouteItem["kind"], typeof Cpu> = {
  cpu: Cpu,
  database: Database,
  workflow: Workflow,
};

const fallbackPipeline = [
  { label: "意图识别", value: "等待请求", tone: "green" },
  { label: "知识检索", value: "待触发", tone: "cyan" },
  { label: "权限过滤", value: "待校验", tone: "amber" },
  { label: "响应生成", value: "待生成", tone: "rose" },
];

export function ContextPanel({ context, activeSession }: ContextPanelProps) {
  const pipeline = context?.pipeline?.length ? context.pipeline : fallbackPipeline;
  const routing = context?.routing?.length
    ? context.routing
    : [
        { label: "主模型", value: activeSession.model || "未选择", kind: "cpu" as const },
        { label: "向量模型", value: "未配置", kind: "database" as const },
        { label: "重排模型", value: "未配置", kind: "workflow" as const },
      ];
  const audit = context?.audit ?? {
    enabled: false,
    title: "审计链路未开启",
    description: "请在系统设置中开启审计后记录调用链路",
  };

  return (
    <aside className="context-panel">
      <section className="side-section">
        <header>
          <span className="eyebrow">Runtime</span>
          <h3>响应编排</h3>
        </header>
        <div className="pipeline-list">
          {pipeline.map((item) => (
            <div className="pipeline-step" data-tone={item.tone} key={item.label}>
              <span />
              <strong>{item.label}</strong>
              <em>{item.value}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="side-section">
        <header>
          <span className="eyebrow">Routing</span>
          <h3>模型路由</h3>
        </header>
        <div className="route-list">
          {routing.map((item) => {
            const Icon = routeIcons[item.kind] ?? Cpu;
            return (
              <div key={item.label}>
                <Icon size={16} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`side-section ${audit.enabled ? "audit-ok" : ""}`}>
        <Zap size={18} />
        <span>
          <strong>{audit.title}</strong>
          <small>{audit.description}</small>
        </span>
      </section>
    </aside>
  );
}
