import { RefreshCw, RotateCcw } from "lucide-react";
import type { Provider } from "../../types/model";

interface ModelTableProps {
  currentProvider?: Provider;
  testingProviderId: string;
  syncingProviderId: string;
  testConnection: (id?: string) => void;
  syncModels: (id?: string) => void;
  toggleModel: (id: string) => void;
}

export function ModelTable({
  currentProvider,
  testingProviderId,
  syncingProviderId,
  testConnection,
  syncModels,
  toggleModel,
}: ModelTableProps) {
  return (
    <>
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
        {!currentProvider || currentProvider.models.length === 0 ? (
          <div className="model-row">
            <span>暂无模型</span>
            <span>点击同步模型</span>
            <span>—</span>
            <span>—</span>
            <span className="capability-row">
              <em>OpenAI-compatible</em>
            </span>
            <span>—</span>
          </div>
        ) : (
          currentProvider.models.map((model) => (
            <div className="model-row" key={model.id}>
              <span>
                <strong>{model.name}</strong>
                <small>{model.provider}</small>
              </span>
              <span>{model.context}</span>
              <span>{model.maxOutput.toLocaleString()}</span>
              <span>{model.temperature}</span>
              <span className="capability-row">
                {model.capabilities.length > 0 ? (
                  model.capabilities.map((cap) => <em key={cap}>{cap}</em>)
                ) : (
                  <em>未标注</em>
                )}
              </span>
              <span>
                <button
                  className={`switch ${model.active ? "on" : ""}`}
                  onClick={() => toggleModel(model.id)}
                  type="button"
                />
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
