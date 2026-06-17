import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Cloud,
  Cpu,
  Gauge,
  HardDrive,
  KeyRound,
  Plus,
  RotateCcw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from "lucide-react";

type ProviderStatus = "connected" | "limited" | "offline";

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
  status: ProviderStatus;
  endpoint: string;
  models: ModelConfig[];
};

const initialProviders: Provider[] = [
  {
    id: "openai",
    name: "OpenAI",
    type: "cloud",
    status: "connected",
    endpoint: "https://api.openai.com/v1",
    models: [
      {
        id: "gpt-41",
        name: "GPT-4.1 Enterprise",
        provider: "OpenAI",
        context: "128K",
        maxOutput: 8192,
        temperature: 0.4,
        active: true,
        capabilities: ["问答", "代码", "工具调用", "长上下文"],
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o mini",
        provider: "OpenAI",
        context: "128K",
        maxOutput: 4096,
        temperature: 0.3,
        active: true,
        capabilities: ["问答", "摘要", "低延迟"],
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    type: "cloud",
    status: "connected",
    endpoint: "https://api.anthropic.com/v1",
    models: [
      {
        id: "claude-sonnet",
        name: "Claude 3.5 Sonnet",
        provider: "Anthropic",
        context: "200K",
        maxOutput: 8192,
        temperature: 0.5,
        active: true,
        capabilities: ["文档分析", "代码", "长文本"],
      },
    ],
  },
  {
    id: "local",
    name: "本地推理集群",
    type: "local",
    status: "limited",
    endpoint: "http://localhost:11434",
    models: [
      {
        id: "qwen-local",
        name: "Qwen2.5 72B",
        provider: "Local",
        context: "32K",
        maxOutput: 4096,
        temperature: 0.6,
        active: false,
        capabilities: ["离线", "中文", "代码"],
      },
    ],
  },
];

const statusLabel: Record<ProviderStatus, string> = {
  connected: "已连接",
  limited: "受限",
  offline: "离线",
};

export default function ModelPage() {
  const [providers, setProviders] = useState(initialProviders);
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [temperature, setTemperature] = useState(0.4);
  const [topK, setTopK] = useState(8);
  const [safetyFilter, setSafetyFilter] = useState(true);
  const [fallback, setFallback] = useState(true);
  const [trace, setTrace] = useState(true);

  const allModels = useMemo(() => providers.flatMap((provider) => provider.models), [providers]);
  const activeModels = allModels.filter((model) => model.active).length;
  const currentProvider = providers.find((provider) => provider.id === selectedProvider) ?? providers[0];

  const toggleModel = (modelId: string) => {
    setProviders((prev) =>
      prev.map((provider) => ({
        ...provider,
        models: provider.models.map((model) =>
          model.id === modelId ? { ...model, active: !model.active } : model,
        ),
      })),
    );
  };

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

      <div className="model-layout">
        <section className="provider-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Providers</span>
              <h2>模型供应商</h2>
            </div>
            <button className="icon-button" title="添加供应商" type="button">
              <Plus size={17} />
            </button>
          </div>

          <div className="provider-list">
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
                <em className={`provider-status ${provider.status}`}>{statusLabel[provider.status]}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="model-config-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Models</span>
              <h2>{currentProvider.name} 模型列表</h2>
            </div>
            <button className="secondary-action" type="button">
              <RotateCcw size={16} />
              测试连接
            </button>
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
            {currentProvider.models.map((model) => (
              <div className="model-row" key={model.id}>
                <span>
                  <strong>{model.name}</strong>
                  <small>{model.provider}</small>
                </span>
                <span>{model.context}</span>
                <span>{model.maxOutput.toLocaleString()}</span>
                <span>{model.temperature}</span>
                <span className="capability-row">
                  {model.capabilities.map((capability) => (
                    <em key={capability}>{capability}</em>
                  ))}
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
                <input
                  max="1"
                  min="0"
                  onChange={(event) => setTemperature(Number(event.target.value))}
                  step="0.1"
                  type="range"
                  value={temperature}
                />
              </label>
              <label className="range-control">
                <span>Top-K 检索 <strong>{topK}</strong></span>
                <input
                  max="16"
                  min="3"
                  onChange={(event) => setTopK(Number(event.target.value))}
                  step="1"
                  type="range"
                  value={topK}
                />
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
                <strong>{currentProvider.endpoint}</strong>
              </div>
              <div className="endpoint-row">
                <span>API Key</span>
                <strong>sk-****-enterprise</strong>
              </div>
              <div className="endpoint-row ok">
                <CheckCircle2 size={16} />
                <span>凭据校验通过</span>
              </div>
            </section>

            <section className="config-panel route-panel">
              <header>
                <Zap size={18} />
                <strong>路由优先级</strong>
              </header>
              <ol>
                <li>企业知识问答: GPT-4.1 Enterprise</li>
                <li>长文档分析: Claude 3.5 Sonnet</li>
                <li>低延迟摘要: GPT-4o mini</li>
                <li>离线场景: Qwen2.5 72B</li>
              </ol>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
