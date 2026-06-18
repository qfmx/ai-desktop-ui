import { useEffect, useState } from "react";
import { Bell, ChevronDown, Search, ShieldCheck } from "lucide-react";
import Sidebar, { type PageKey } from "./components/layout/Sidebar";
import ChatPage from "./pages/ChatPage";
import KnowledgePage from "./pages/KnowledgePage";
import ModelPage from "./pages/ModelPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import { api } from "./services/api";
import "./App.css";

const pageTitles: Record<PageKey, { title: string; subtitle: string }> = {
  chat: {
    title: "智能问答",
    subtitle: "基于企业知识库的可溯源问答与任务编排",
  },
  knowledge: {
    title: "知识库",
    subtitle: "统一管理文档、切片、索引、权限和同步状态",
  },
  model: {
    title: "模型配置",
    subtitle: "维护供应商、模型参数、路由策略和安全开关",
  },
  history: {
    title: "对话历史",
    subtitle: "检索、归档和导出团队问答记录",
  },
  settings: {
    title: "系统设置",
    subtitle: "配置默认偏好、安全策略和数据治理选项",
  },
};

function App() {
  const [activePage, setActivePage] = useState<PageKey>("chat");
  const [defaultModel, setDefaultModel] = useState("默认模型");
  const page = pageTitles[activePage];

  useEffect(() => {
    api.settings
      .get()
      .then((settings) => setDefaultModel(settings.default_llm_model || "默认模型"))
      .catch(() => setDefaultModel("默认模型"));
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case "chat":
        return <ChatPage />;
      case "knowledge":
        return <KnowledgePage />;
      case "model":
        return <ModelPage />;
      case "history":
        return <HistoryPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="app-main">
        <header className="app-topbar">
          <div className="page-heading">
            <span className="live-dot" />
            <div>
              <h1>{page.title}</h1>
              <p>{page.subtitle}</p>
            </div>
          </div>

          <div className="topbar-actions">
            <label className="global-search">
              <Search size={17} />
              <input aria-label="全局搜索" placeholder="搜索会话、知识库、模型" />
            </label>
            <button className="model-pill" type="button">
              {defaultModel}
              <ChevronDown size={16} />
            </button>
            <button className="icon-button" title="安全审计" type="button">
              <ShieldCheck size={18} />
            </button>
            <button className="icon-button" title="通知" type="button">
              <Bell size={18} />
            </button>
          </div>
        </header>
        <section className="page-frame">{renderPage()}</section>
      </main>
    </div>
  );
}

export default App;
