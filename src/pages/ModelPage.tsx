import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Cloud,
  Cpu,
  Gauge,
  HardDrive,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { api } from "../services/api";

type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  context: string;
  maxOutput: number;
  temperature: number;
  active: boolean;
  capabilities: string[];
};

type Provider = {
  id: string;
  name: string;
  type: "cloud" | "local";
  status: string;
  endpoint: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  models: ModelConfig[];
};

type ProviderForm = {
  id: string;
  name: string;
  type: "cloud" | "local";
  endpoint: string;
  api_key: string;
  auto_sync_models: boolean;
};

const initialProviderForm: ProviderForm = {
  id: "",
  name: "",
  type: "cloud",
  endpoint: "https://api.openai.com/v1",
  api_key: "",
  auto_sync_models: true,
};

function parseCapabilities(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapProvider(p: any): Provider {
  return {
    id: p.id,
    name: p.name,
    type: p.type || "cloud",
    status: p.status || "connected",
    endpoint: p.endpoint || "",
    hasApiKey: Boolean(p.has_api_key),
    apiKeyMasked: p.api_key_masked || "",
    models: (p.models || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      provider: p.name,
      context: m.context_length || "未知",
      maxOutput: m.max_output || 4096,
      temperature: m.temperature ?? 0.4,
      active: Boolean(m.active),
      capabilities: parseCapabilities(m.capabilities),
    })),
  };
}

function statusLabel(status: string) {
  if (status === "connected") return "已连接";
  if (status === "limited") return "受限";
  if (status === "offline") return "离线";
  return status || "未知";
}

export default function ModelPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [temperature, setTemperature] = useState(0.4);
  const [topK, setTopK] = useState(8);
  const [safetyFilter, setSafetyFilter] = useState(true);
  const [fallback, setFallback] = useState(true);
  const [trace, setTrace] = useState(true);
  const [backendOk, setBackendOk] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState("");
  const [syncingProviderId, setSyncingProviderId] = useState("");
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [providerForm, setProviderForm] = useState<ProviderForm>(initialProviderForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProviders = async (preferredId?: string) => {
    setLoadingProviders(true);
    setError("");
    try {
      const list = await api.models.providers();
      const mapped = list.map(mapProvider);
      setProviders(mapped);
      const nextId = preferredId || selectedProvider;
      if (nextId && mapped.some((provider) => provider.id === nextId)) {
        setSelectedProvider(nextId);
      } else if (mapped.length > 0) {
        setSelectedProvider(mapped[0].id);
      } else {
        setSelectedProvider("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载模型供应商失败");
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    api.health()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  useEffect(() => {
    if (!backendOk) return;
    void loadProviders();
  }, [backendOk]);

  const allModels = useMemo(() => providers.flatMap((p) => p.models), [providers]);
  const activeModels = allModels.filter((m) => m.active).length;
  const currentProvider = providers.find((p) => p.id === selectedProvider) ?? providers[0];

  const toggleModel = async (modelId: string) => {
    const currentModel = providers.flatMap((p) => p.models).find((m) => m.id === modelId);
    if (!currentModel) return;

    const nextActive = !currentModel.active;
    setError("");
    setProviders((prev) =>
      prev.map((p) => ({
        ...p,
        models: p.models.map((m) =>
          m.id === modelId ? { ...m, active: nextActive } : m
        ),
      }))
    );

    try {
      await api.models.updateModel(modelId, { active: nextActive });
      setNotice(nextActive ? "模型已启用" : "模型已停用");
    } catch (err) {
      setProviders((prev) =>
        prev.map((p) => ({
          ...p,
          models: p.models.map((m) =>
            m.id === modelId ? { ...m, active: currentModel.active } : m
          ),
        }))
      );
      setError(err instanceof Error ? err.message : "更新模型状态失败");
    }
  };

  const testConnection = async (providerId?: string) => {
    if (!providerId) return;
    setTestingProviderId(providerId);
    setError("");
    setNotice("");
    try {
      const result = await api.models.test(providerId);
      await loadProviders(providerId);
      setNotice(result.ok ? `连接成功，发现 ${result.fetched ?? 0} 个模型` : `连接失败：${result.error || "请检查配置"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "测试连接失败");
    } finally {
      setTestingProviderId("");
    }
  };

  const syncModels = async (providerId?: string) => {
    if (!providerId) return;
    setSyncingProviderId(providerId);
    setError("");
    setNotice("");
    try {
      const result = await api.models.sync(providerId, { protocol: "openai", overwrite: false });
      await loadProviders(providerId);
      setNotice(`同步完成：获取 ${result.fetched ?? 0} 个，新增 ${result.inserted ?? 0} 个，更新 ${result.updated ?? 0} 个`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步模型失败");
    } finally {
      setSyncingProviderId("");
    }
  };

  const handleCreateProvider = async (event: FormEvent) => {
    event.preventDefault();
    setCreatingProvider(true);
    setError("");
    setNotice("");
    try {
      const result = await api.models.create({
        ...providerForm,
        protocol: "openai",
      });
      const providerId = result.provider?.id || providerForm.id;
      setProviderForm(initialProviderForm);
      setShowProviderForm(false);
      await loadProviders(providerId);
      if (result.sync?.ok === false) {
        setNotice(`供应商已创建，但自动同步失败：${result.sync.error}`);
      } else if (result.sync) {
        setNotice(`供应商已创建并同步 ${result.sync.fetched ?? 0} 个模型`);
      } else {
        setNotice("供应商已创建");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建供应商失败");
    } finally {
      setCreatingProvider(false);
    }
  };

  if (!backendOk) {
    return (
      <div className="workspace-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <p style={{ opacity: 0.6 }}>正在连接后端服务...</p>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <section className="summary-grid">
        <article className="summary-card" data-tone="cyan">
          <Server size={20} />
          <span>供应商</span>
          <strong>{providers.length}</strong>
        </article>
        <article className="summary-card" data-tone="green">
          <Cpu size={20} />
          <span>可用模型</span>
          <strong>{allModels.length}</strong>
        </article>
        <article className="summary-card" data-tone="amber">
          <Activity size={20} />
          <span>已启用</span>
          <strong>{activeModels}</strong>
        </article>
        <article className="summary-card" data-tone="rose">
          <Gauge size={20} />
          <span>平均可用率</span>
          <strong>99.7%</strong>
        </article>
      </section>

      {(error || notice) && (
        <section className="page-toolbar" style={{ borderColor: error ? "rgba(244, 63, 94, 0.35)" : "rgba(34, 197, 94, 0.25)" }}>
          <span style={{ color: error ? "#fda4af" : "#86efac" }}>{error || notice}</span>
        </section>
      )}

      <div className="model-layout">
        <section className="provider-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Providers</span>
              <h2>模型供应商</h2>
            </div>
            <button className="icon-button" onClick={() => setShowProviderForm((value) => !value)} title="添加供应商" type="button">
              <Plus size={17} />
            </button>
          </div>

          {showProviderForm && (
            <form className="config-panel" onSubmit={handleCreateProvider} style={{ marginBottom: 16 }}>
              <header>
                <Cloud size={18} />
                <strong>新增 OpenAI-compatible 供应商</strong>
              </header>
              <label className="range-control">
                <span>供应商名称</span>
                <input
                  onChange={(event) => setProviderForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="例如：OpenAI / DeepSeek / 企业网关"
                  required
                  type="text"
                  value={providerForm.name}
                />
              </label>
              <label className="range-control">
                <span>供应商 ID（可选）</span>
                <input
                  onChange={(event) => setProviderForm((prev) => ({ ...prev, id: event.target.value }))}
                  placeholder="不填则自动生成"
                  type="text"
                  value={providerForm.id}
                />
              </label>
              <label className="range-control">
                <span>Endpoint</span>
                <input
                  onChange={(event) => setProviderForm((prev) => ({ ...prev, endpoint: event.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  required
                  type="url"
                  value={providerForm.endpoint}
                />
              </label>
              <label className="range-control">
                <span>API Key</span>
                <input
                  onChange={(event) => setProviderForm((prev) => ({ ...prev, api_key: event.target.value }))}
                  placeholder="sk-..."
                  type="password"
                  value={providerForm.api_key}
                />
              </label>
              <label className="toggle-row">
                <span>
                  <strong>本地供应商</strong>
                  <small>关闭时按云端供应商展示</small>
                </span>
                <input
                  checked={providerForm.type === "local"}
                  onChange={() => setProviderForm((prev) => ({ ...prev, type: prev.type === "local" ? "cloud" : "local" }))}
                  type="checkbox"
                />
              </label>
              <label className="toggle-row">
                <span>
                  <strong>创建后自动同步模型</strong>
                  <small>调用 OpenAI-compatible /models 接口填充模型</small>
                </span>
                <input
                  checked={providerForm.auto_sync_models}
                  onChange={() => setProviderForm((prev) => ({ ...prev, auto_sync_models: !prev.auto_sync_models }))}
                  type="checkbox"
                />
              </label>
              <button className="primary-action compact" disabled={creatingProvider} type="submit">
                <Plus size={16} />
                {creatingProvider ? "创建中" : "创建供应商"}
              </button>
            </form>
          )}

          <div className="provider-list">
            {loadingProviders && <small style={{ opacity: 0.6 }}>正在加载供应商...</small>}
            {providers.map((provider) => (
              <button
                className={`provider-card ${selectedProvider === provider.id ? "selected" : ""}`}
                key={provider.id}
                onClick={() => setSelectedProvider(provider.id)}
                type="button"
              >
                <div className="provider-icon">
                  {provider.type === "cloud" ? <Cloud size={19} /> : <HardDrive size={19} />}
                </div>
                <span>
                  <strong>{provider.name}</strong>
                  <small>{provider.endpoint}</small>
                </span>
                <em className={`provider-status ${provider.status}`}>{statusLabel(provider.status)}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="model-config-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Models</span>
              <h2>{currentProvider?.name || "未选择供应商"} 模型列表</h2>
            </div>
            <div className="toolbar-buttons">
              <button
                className="secondary-action"
                disabled={!currentProvider || testingProviderId === currentProvider.id}
                onClick={() => testConnection(currentProvider?.id)}
                type="button"
              >
                <RotateCcw size={16} />
                {testingProviderId === currentProvider?.id ? "测试中" : "测试连接"}
              </button>
              <button
                className="secondary-action"
                disabled={!currentProvider || syncingProviderId === currentProvider.id}
                onClick={() => syncModels(currentProvider?.id)}
                type="button"
              >
                <RefreshCw size={16} />
                {syncingProviderId === currentProvider?.id ? "同步中" : "同步模型"}
              </button>
            </div>
          </div>

          <div className="model-table">
            <div className="model-row head">
              <span>模型</span>
              <span>上下文</span>
              <span>最大输出</span>
              <span>温度</span>
              <span>能力</span>
              <span>启用</span>
            </div>
            {currentProvider?.models.length === 0 && (
              <div className="model-row">
                <span>暂无模型</span>
                <span>点击同步模型</span>
                <span>—</span>
                <span>—</span>
                <span className="capability-row"><em>OpenAI-compatible</em></span>
                <span>—</span>
              </div>
            )}
            {currentProvider?.models.map((model) => (
              <div className="model-row" key={model.id}>
                <span>
                  <strong>{model.name}</strong>
                  <small>{model.provider}</small>
                </span>
                <span>{model.context}</span>
                <span>{model.maxOutput.toLocaleString()}</span>
                <span>{model.temperature}</span>
                <span className="capability-row">
                  {model.capabilities.length > 0 ? model.capabilities.map((cap) => (
                    <em key={cap}>{cap}</em>
                  )) : <em>未标注</em>}
                </span>
                <span>
                  <button
                    className={`switch ${model.active ? "on" : ""}`}
                    onClick={() => toggleModel(model.id)}
                    type="button"
                  />
                </span>
              </div>
            ))}
          </div>

          <div className="config-grid">
            <section className="config-panel">
              <header>
                <SlidersHorizontal size={18} />
                <strong>默认参数</strong>
              </header>
              <label className="range-control">
                <span>温度 <strong>{temperature.toFixed(1)}</strong></span>
                <input max="1" min="0" onChange={(e) => setTemperature(Number(e.target.value))} step="0.1" type="range" value={temperature} />
              </label>
              <label className="range-control">
                <span>Top-K 检索 <strong>{topK}</strong></span>
                <input max="16" min="3" onChange={(e) => setTopK(Number(e.target.value))} step="1" type="range" value={topK} />
              </label>
            </section>

            <section className="config-panel">
              <header>
                <ShieldCheck size={18} />
                <strong>安全策略</strong>
              </header>
              <label className="toggle-row">
                <span>
                  <strong>敏感信息过滤</strong>
                  <small>自动识别并脱敏隐私字段</small>
                </span>
                <input checked={safetyFilter} onChange={() => setSafetyFilter(!safetyFilter)} type="checkbox" />
              </label>
              <label className="toggle-row">
                <span>
                  <strong>多模型回退</strong>
                  <small>主模型异常时切换备用模型</small>
                </span>
                <input checked={fallback} onChange={() => setFallback(!fallback)} type="checkbox" />
              </label>
              <label className="toggle-row">
                <span>
                  <strong>调用链追踪</strong>
                  <small>记录请求、检索与响应来源</small>
                </span>
                <input checked={trace} onChange={() => setTrace(!trace)} type="checkbox" />
              </label>
            </section>

            <section className="config-panel endpoint-panel">
              <header>
                <KeyRound size={18} />
                <strong>访问凭据</strong>
              </header>
              <div className="endpoint-row">
                <span>Endpoint</span>
                <strong>{currentProvider?.endpoint || "—"}</strong>
              </div>
              <div className="endpoint-row">
                <span>API Key</span>
                <strong>{currentProvider?.hasApiKey ? currentProvider.apiKeyMasked || "****" : "未配置"}</strong>
              </div>
              <div className={`endpoint-row ${currentProvider?.status === "connected" ? "ok" : ""}`}>
                <CheckCircle2 size={16} />
                <span>{currentProvider?.status === "connected" ? "凭据校验通过" : "未验证"}</span>
              </div>
            </section>

            <section className="config-panel route-panel">
              <header>
                <Zap size={18} />
                <strong>路由优先级</strong>
              </header>
              <ol>
                <li>企业知识问答: {currentProvider?.models?.find((model) => model.active)?.name || "—"}</li>
                <li>长文档分析: {allModels.find((model) => model.name.toLowerCase().includes("claude"))?.name || "—"}</li>
                <li>低延迟摘要: {allModels.find((model) => model.name.toLowerCase().includes("mini"))?.name || "—"}</li>
                <li>离线场景: {providers.find((provider) => provider.type === "local")?.models?.[0]?.name || "—"}</li>
              </ol>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
