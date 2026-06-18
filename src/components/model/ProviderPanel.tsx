import type { FormEvent } from "react";
import { Cloud, HardDrive, Plus } from "lucide-react";
import type { Provider, ProviderForm } from "../../types/model";

interface ProviderPanelProps {
  providers: Provider[];
  selectedProvider: string;
  onSelectProvider: (id: string) => void;
  loadingProviders: boolean;
  showProviderForm: boolean;
  setShowProviderForm: (show: boolean | ((prev: boolean) => boolean)) => void;
  providerForm: ProviderForm;
  setProviderForm: React.Dispatch<React.SetStateAction<ProviderForm>>;
  creatingProvider: boolean;
  handleCreateProvider: (event: FormEvent) => Promise<void>;
}

function statusLabel(status: string) {
  if (status === "connected") return "已连接";
  if (status === "limited") return "受限";
  if (status === "offline") return "离线";
  return status || "未知";
}

export function ProviderPanel({
  providers,
  selectedProvider,
  onSelectProvider,
  loadingProviders,
  showProviderForm,
  setShowProviderForm,
  providerForm,
  setProviderForm,
  creatingProvider,
  handleCreateProvider,
}: ProviderPanelProps) {
  return (
    <section className="provider-panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">Providers</span>
          <h2>模型供应商</h2>
        </div>
        <button
          className="icon-button"
          onClick={() => setShowProviderForm((value) => !value)}
          title="添加供应商"
          type="button"
        >
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
              onChange={(event) =>
                setProviderForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="例如：OpenAI / DeepSeek / 企业网关"
              required
              type="text"
              value={providerForm.name}
            />
          </label>
          <label className="range-control">
            <span>供应商 ID（可选）</span>
            <input
              onChange={(event) =>
                setProviderForm((prev) => ({ ...prev, id: event.target.value }))
              }
              placeholder="不填则自动生成"
              type="text"
              value={providerForm.id}
            />
          </label>
          <label className="range-control">
            <span>Endpoint</span>
            <input
              onChange={(event) =>
                setProviderForm((prev) => ({ ...prev, endpoint: event.target.value }))
              }
              placeholder="https://api.openai.com/v1"
              required
              type="url"
              value={providerForm.endpoint}
            />
          </label>
          <label className="range-control">
            <span>API Key</span>
            <input
              onChange={(event) =>
                setProviderForm((prev) => ({ ...prev, api_key: event.target.value }))
              }
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
              onChange={() =>
                setProviderForm((prev) => ({
                  ...prev,
                  type: prev.type === "local" ? "cloud" : "local",
                }))
              }
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
              onChange={() =>
                setProviderForm((prev) => ({
                  ...prev,
                  auto_sync_models: !prev.auto_sync_models,
                }))
              }
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
            onClick={() => onSelectProvider(provider.id)}
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
  );
}
