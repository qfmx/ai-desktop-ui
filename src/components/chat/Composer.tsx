import { Database, Paperclip, Send, ShieldCheck } from "lucide-react";

interface ComposerProps {
  input: string;
  isGenerating: boolean;
  knowledgeScope: string;
  topK: number;
  temperature: number;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function Composer({
  input,
  isGenerating,
  knowledgeScope,
  topK,
  temperature,
  onInputChange,
  onSend,
}: ComposerProps) {
  return (
    <div className="composer-panel">
      <div className="composer-tools">
        <button className="icon-button" title="添加附件" type="button">
          <Paperclip size={17} />
        </button>
        <button className="tool-chip active" type="button">
          <Database size={15} />
          {knowledgeScope}
        </button>
        <button className="tool-chip" type="button">
          <ShieldCheck size={15} />
          权限检查
        </button>
      </div>
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
        placeholder="在这里输入您的问题..."
      />
      <footer>
        <span>
          Top-K {topK} · 温度 {temperature.toFixed(1)} · 引用溯源开启
        </span>
        <button
          className="send-button"
          disabled={!input.trim() || isGenerating}
          onClick={onSend}
          type="button"
        >
          <Send size={17} />
          发送
        </button>
      </footer>
    </div>
  );
}
