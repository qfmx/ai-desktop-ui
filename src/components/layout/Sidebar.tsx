import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Cpu,
  History,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../services/api";

export type PageKey = "chat" | "knowledge" | "model" | "history" | "settings";

type SidebarProps = {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
};

type NavItem = {
  key: PageKey;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const navItems: NavItem[] = [
  { key: "chat", label: "智能问答", icon: MessageSquare, badge: "NEW" },
  { key: "knowledge", label: "知识库", icon: BookOpen },
  { key: "model", label: "模型配置", icon: Cpu },
  { key: "history", label: "对话历史", icon: History },
  { key: "settings", label: "系统设置", icon: Settings },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [serviceOnline, setServiceOnline] = useState(false);
  const [auditEnabled, setAuditEnabled] = useState(false);

  useEffect(() => {
    void Promise.all([api.health(), api.settings.get()])
      .then(([, settings]) => {
        setServiceOnline(true);
        setAuditEnabled(Boolean(settings.audit_enabled));
      })
      .catch(() => {
        setServiceOnline(false);
        setAuditEnabled(false);
      });
  }, []);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <Sparkles size={21} />
        </div>
        {!collapsed && (
          <div className="brand-copy">
            <strong>AI 工作台</strong>
            <span>Enterprise Console</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="主导航">
        {!collapsed && <span className="nav-caption">工作区</span>}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.key;

          return (
            <button
              className={`nav-button ${isActive ? "active" : ""}`}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              title={collapsed ? item.label : undefined}
              type="button"
            >
              <Icon size={19} />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.badge && <em>{item.badge}</em>}
            </button>
          );
        })}
      </nav>

      <section className="sidebar-status">
        <div className="status-title">
          <Zap size={15} />
          {!collapsed && <span>系统状态</span>}
        </div>
        {!collapsed && (
          <>
            <div className="status-line">
              <span className="status-dot" />
              <strong>{serviceOnline ? "后端服务在线" : "等待后端连接"}</strong>
            </div>
            <p>{auditEnabled ? "审计开启" : "审计关闭"} · 数据本地持久化</p>
          </>
        )}
      </section>

      <section className="sidebar-security">
        <ShieldCheck size={17} />
        {!collapsed && (
          <span>
            <strong>私有化部署</strong>
            <small>数据隔离 · 权限可追溯</small>
          </span>
        )}
      </section>

      <button
        className="collapse-button"
        onClick={() => setCollapsed((value) => !value)}
        title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        type="button"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
