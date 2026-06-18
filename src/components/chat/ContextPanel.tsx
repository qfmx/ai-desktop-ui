import { Cpu, Database, Workflow, Zap } from "lucide-react";
import type { ChatSession } from "./types";

interface ContextPanelProps {
  activeSession: ChatSession;
}

export function ContextPanel({ activeSession }: ContextPanelProps) {
  return (
    <aside className="context-panel">
      <section className="side-section">
        <header>
          <span className="eyebrow">Runtime</span>
          <h3>响应编排</h3>
        </header>
        <div className="pipeline-list">
          {[
            { label: "意图识别", value: "已完成", tone: "green" },
            { label: "知识检索", value: "18 条", tone: "cyan" },
            { label: "权限过滤", value: "已通过", tone: "amber" },
            { label: "响应生成", value: "流式", tone: "rose" },
          ].map((item) => (
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
          <div>
            <Cpu size={16} />
            <span>主模型</span>
            <strong>{activeSession.model || "未选择"}</strong>
          </div>
          <div>
            <Database size={16} />
            <span>向量模型</span>
            <strong>text-embedding-3-large</strong>
          </div>
          <div>
            <Workflow size={16} />
            <span>重排模型</span>
            <strong>bge-reranker-v2</strong>
          </div>
        </div>
      </section>

      <section className="side-section audit-ok">
        <Zap size={18} />
        <span>
          <strong>审计链路已记录</strong>
          <small>请求、检索、引用和权限策略完整留痕</small>
        </span>
      </section>
    </aside>
  );
}
