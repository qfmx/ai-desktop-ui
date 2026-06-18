import { CheckCircle2 } from "lucide-react";
import type { AccessRule } from "../../types/knowledge";

interface PermissionMatrixProps {
  rules: AccessRule[];
}

export function PermissionMatrix({ rules }: PermissionMatrixProps) {
  return (
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
        {rules.map((rule) => (
          <div className="matrix-row" key={rule.id}>
            <span>{rule.name}</span>
            <span>{rule.owner}</span>
            <span>{rule.roles.join(" · ")}</span>
            <strong>{rule.policy}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
