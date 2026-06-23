import { CheckCircle2, KeyRound, Save, ShieldCheck, SlidersHorizontal, Zap } from "lucide-react";
import type { ModelConfig, Provider } from "../../types/model";

interface ModelConfigGridsProps {
  defaultChatModelId: string;
  setDefaultChatModelId: (v: string) => void;
  defaultEmbeddingModelId: string;
  setDefaultEmbeddingModelId: (v: string) => void;
  defaultRerankModelId: string;
  setDefaultRerankModelId: (v: string) => void;
  temperature: number;
  setTemperature: (v: number) => void;
  topK: number;
  setTopK: (v: number) => void;
  safetyFilter: boolean;
  setSafetyFilter: (v: boolean) => void;
  fallback: boolean;
  setFallback: (v: boolean) => void;
  trace: boolean;
  setTrace: (v: boolean) => void;
  currentProvider?: Provider;
  allModels: ModelConfig[];
  providers: Provider[];
  savingSettings: boolean;
  onSaveSettings: () => void;
}

function hasCapability(model: ModelConfig, name: string) {
  return model.capabilities.some((cap) => cap.toLowerCase() === name.toLowerCase() || cap === name);
}

function modelLabel(model?: ModelConfig) {
  if (!model) return "—";
  return `${model.provider} / ${model.name}`;
}

export function ModelConfigGrids({
  defaultChatModelId,
  setDefaultChatModelId,
  defaultEmbeddingModelId,
  setDefaultEmbeddingModelId,
  defaultRerankModelId,
  setDefaultRerankModelId,
  temperature,
  setTemperature,
  topK,
  setTopK,
  safetyFilter,
  setSafetyFilter,
  fallback,
  setFallback,
  trace,
  setTrace,
  currentProvider,
  allModels,
  providers,
  savingSettings,
  onSaveSettings,
}: ModelConfigGridsProps) {
  const chatModels = allModels.filter(
    (model) => model.active && !hasCapability(model, "嵌入") && !hasCapability(model, "重排")
  );
  const embeddingModels = allModels.filter((model) => hasCapability(model, "嵌入"));
  const rerankModels = allModels.filter((model) => hasCapability(model, "重排"));
  const selectedChatModel = allModels.find((model) => model.id === defaultChatModelId);
  const selectedEmbeddingModel = allModels.find((model) => model.id === defaultEmbeddingModelId);
  const selectedRerankModel = allModels.find((model) => model.id === defaultRerankModelId);

  return (
    <div className="config-grid">
      <section className="config-panel">
        <header>
          <SlidersHorizontal size={18} />
          <strong>默认参数</strong>
        </header>
        <label className="range-control">
          <span>默认聊天模型</span>
          <select
            onChange={(event) => setDefaultChatModelId(event.target.value)}
            value={defaultChatModelId}
          >
            {chatModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.provider} / {model.name}
              </option>
            ))}
          </select>
        </label>
        <label className="range-control">
          <span>默认 Embedding 模型</span>
          <select
            onChange={(event) => setDefaultEmbeddingModelId(event.target.value)}
            value={defaultEmbeddingModelId}
          >
            {embeddingModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.provider} / {model.name}
              </option>
            ))}
          </select>
        </label>
        <label className="range-control">
          <span>默认 Rerank 模型</span>
          <select
            onChange={(event) => setDefaultRerankModelId(event.target.value)}
            value={defaultRerankModelId}
          >
            {rerankModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.provider} / {model.name}
              </option>
            ))}
          </select>
        </label>
        <label className="range-control">
          <span>
            温度 <strong>{temperature.toFixed(1)}</strong>
          </span>
          <input
            max="1"
            min="0"
            onChange={(e) => setTemperature(Number(e.target.value))}
            step="0.1"
            type="range"
            value={temperature}
          />
        </label>
        <label className="range-control">
          <span>
            Top-K 检索 <strong>{topK}</strong>
          </span>
          <input
            max="16"
            min="3"
            onChange={(e) => setTopK(Number(e.target.value))}
            step="1"
            type="range"
            value={topK}
          />
        </label>
        <button
          className="primary-action compact"
          disabled={savingSettings}
          onClick={onSaveSettings}
          type="button"
        >
          <Save size={16} />
          {savingSettings ? "保存中" : "保存默认参数"}
        </button>
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
          <input
            checked={safetyFilter}
            onChange={() => setSafetyFilter(!safetyFilter)}
            type="checkbox"
          />
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
          <span>协议</span>
          <strong>{currentProvider?.protocolType || "—"}</strong>
        </div>
        <div className="endpoint-row">
          <span>Base URL</span>
          <strong>{currentProvider?.baseUrl || "—"}</strong>
        </div>
        <div className="endpoint-row">
          <span>API Key</span>
          <strong>
            {currentProvider?.hasApiKey
              ? currentProvider.apiKeyMasked || "****"
              : "未配置"}
          </strong>
        </div>
        <div
          className={`endpoint-row ${
            currentProvider?.status === "connected" ? "ok" : ""
          }`}
        >
          <CheckCircle2 size={16} />
          <span>
            {currentProvider?.status === "connected" ? "凭据校验通过" : "未验证"}
          </span>
        </div>
      </section>

      <section className="config-panel route-panel">
        <header>
          <Zap size={18} />
          <strong>路由优先级</strong>
        </header>
        <ol>
          <li>
            企业知识问答: {modelLabel(selectedChatModel)}
          </li>
          <li>
            向量检索: {modelLabel(selectedEmbeddingModel)}
          </li>
          <li>
            检索重排: {modelLabel(selectedRerankModel)}
          </li>
          <li>
            离线场景:{" "}
            {providers.find((provider) => provider.providerType === "local")?.models?.[0]
              ?.name || "—"}
          </li>
        </ol>
      </section>
    </div>
  );
}
