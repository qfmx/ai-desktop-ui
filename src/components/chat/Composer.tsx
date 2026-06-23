import { Cpu, Database, Send } from "lucide-react";
import type { ChatModelOption } from "../../types/model";

interface ComposerProps {
  input: string;
  isGenerating: boolean;
  knowledgeScope: string;
  chatModels: ChatModelOption[];
  selectedModelConfigId: string;
  onInputChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSend: () => void;
}

export function Composer({
  input,
  isGenerating,
  knowledgeScope,
  chatModels,
  selectedModelConfigId,
  onInputChange,
  onModelChange,
  onSend,
}: ComposerProps) {
  return (
    <div className="composer-panel">
      <div className="composer-topline">
        <label className="model-select-chip" title="选择问答模型">
          <Cpu size={15} />
          <select
            aria-label="选择问答模型"
            disabled={chatModels.length === 0}
            onChange={(event) => onModelChange(event.target.value)}
            value={selectedModelConfigId}
          >
            {chatModels.length === 0 && <option value="">未配置可用模型</option>}
            {chatModels.map((model) => (
              <option key={model.modelConfigId} value={model.modelConfigId}>
                {model.providerName} / {model.displayName}
              </option>
            ))}
          </select>
        </label>
        <span className="scope-pill" title={knowledgeScope}>
          <Database size={15} />
          {knowledgeScope}
        </span>
      </div>
      <div className="composer-input-wrap">
        <textarea
          aria-label="输入问题"
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          value={input}
          placeholder="输入问题，按 Enter 发送"
        />
        <button
          className="send-button"
          disabled={!input.trim() || isGenerating}
          onClick={onSend}
          type="button"
        >
          <Send size={17} />
          发送
        </button>
      </div>
    </div>
  );
}
