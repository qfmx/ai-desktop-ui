import { useEffect, useState } from "react";
import {
  Bell,
  Database,
  Download,
  Keyboard,
  Monitor,
  Save,
  Shield,
  Upload,
} from "lucide-react";
import { api } from "../services/api";
import { useTheme } from "../contexts/ThemeContext";

const sections = [
  { id: "general", title: "通用设置", icon: Monitor, description: "语言、启动和界面偏好" },
  { id: "prompt", title: "提示词", icon: Keyboard, description: "系统提示词与角色预设" },
  { id: "security", title: "安全隐私", icon: Shield, description: "审计、脱敏与访问控制" },
  { id: "notify", title: "通知偏好", icon: Bell, description: "任务完成和同步提醒" },
  { id: "data", title: "数据治理", icon: Database, description: "备份、导入、导出和清理" },
] as const;

type SectionId = (typeof sections)[number]["id"];

type StorageItem = {
  label: string;
  value: string;
  width: number;
};

type PromptTemplate = {
  id: string;
  name: string;
  description: string;
};

const defaultPrompt =
  "你是企业 AI 工作台助手。回答应基于授权知识库，重要结论需要给出来源；当证据不足时明确说明不确定性。";

export default function SettingsPage() {
  const [section, setSection] = useState<SectionId>("general");
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState("zh-CN");
  const [autoSave, setAutoSave] = useState(true);
  const [restoreSession, setRestoreSession] = useState(true);
  const [audit, setAudit] = useState(true);
  const [masking, setMasking] = useState(true);
  const [notify, setNotify] = useState(true);
  const [sound, setSound] = useState(false);
  const [retentionDays, setRetentionDays] = useState(180);
  const [systemPrompt, setSystemPrompt] = useState(defaultPrompt);
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      api.settings.get(),
      api.settings.storage(),
      api.settings.promptTemplates(),
    ])
      .then(([settings, storage, templates]) => {
        setLanguage(settings.language ?? "zh-CN");
        setAutoSave(settings.auto_save ?? true);
        setRestoreSession(settings.restore_session ?? true);
        setAudit(settings.audit_enabled ?? true);
        setMasking(settings.masking_enabled ?? true);
        setNotify(settings.notifications_enabled ?? true);
        setSound(settings.sound_enabled ?? false);
        setRetentionDays(settings.data_retention_days ?? 180);
        setSystemPrompt(settings.system_prompt ?? defaultPrompt);
        setStorageItems(storage);
        setPromptTemplates(templates);
      })
      .catch(() => {});
  }, []);

  const saveAll = async () => {
    setSaving(true);
    try {
      await api.settings.save({
        language,
        auto_save: autoSave,
        restore_session: restoreSession,
        audit_enabled: audit,
        masking_enabled: masking,
        notifications_enabled: notify,
        sound_enabled: sound,
        data_retention_days: retentionDays,
        system_prompt: systemPrompt,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="设置分类">
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={section === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              <Icon size={18} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <section className="settings-panel">
        {section === "general" && (
          <>
            <header className="section-title">
              <div>
                <span className="eyebrow">General</span>
                <h2>通用设置</h2>
              </div>
            </header>
            <div className="setting-row">
              <span>
                <strong>界面主题</strong>
                <small>选择应用的外观风格</small>
              </span>
              <select value={theme} onChange={(event) => setTheme(event.target.value as "light" | "dark")}>
                <option value="dark">暗色 (Dark)</option>
                <option value="light">亮色 (Light)</option>
              </select>
            </div>
            <div className="setting-row">
              <span>
                <strong>界面语言</strong>
                <small>设置应用显示语言</small>
              </span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </div>
            <ToggleRow checked={autoSave} label="自动保存会话" note="对话内容实时保存到本地工作区" onChange={() => setAutoSave(!autoSave)} />
            <ToggleRow checked={restoreSession} label="启动时恢复上次会话" note="打开应用后回到最后使用的页面" onChange={() => setRestoreSession(!restoreSession)} />
          </>
        )}

        {section === "prompt" && (
          <>
            <header className="section-title">
              <div>
                <span className="eyebrow">Prompt</span>
                <h2>提示词管理</h2>
              </div>
            </header>
            <label className="prompt-editor">
              <span>默认系统提示词</span>
              <textarea onChange={(event) => setSystemPrompt(event.target.value)} rows={7} value={systemPrompt} />
              <small>{systemPrompt.length} 字符</small>
            </label>
            <div className="role-template-grid">
              {promptTemplates.map((template) => (
                <button key={template.id} onClick={() => setSystemPrompt(template.description)} type="button">
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {section === "security" && (
          <>
            <header className="section-title">
              <div>
                <span className="eyebrow">Security</span>
                <h2>安全隐私</h2>
              </div>
            </header>
            <ToggleRow checked={audit} label="操作审计日志" note="记录模型调用、文档检索和权限命中" onChange={() => setAudit(!audit)} />
            <ToggleRow checked={masking} label="敏感信息脱敏" note="自动识别手机号、证件号、密钥和客户敏感字段" onChange={() => setMasking(!masking)} />
            <div className="setting-row">
              <span>
                <strong>数据保留周期</strong>
                <small>控制对话和审计日志的保留时间</small>
              </span>
              <select value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))}>
                <option value={90}>90 天</option>
                <option value={180}>180 天</option>
                <option value={365}>365 天</option>
              </select>
            </div>
          </>
        )}

        {section === "notify" && (
          <>
            <header className="section-title">
              <div>
                <span className="eyebrow">Notify</span>
                <h2>通知偏好</h2>
              </div>
            </header>
            <ToggleRow checked={notify} label="桌面通知" note="任务完成、索引同步完成时发送提醒" onChange={() => setNotify(!notify)} />
            <ToggleRow checked={sound} label="提示音" note="通知到达时播放短提示音" onChange={() => setSound(!sound)} />
          </>
        )}

        {section === "data" && (
          <>
            <header className="section-title">
              <div>
                <span className="eyebrow">Data</span>
                <h2>数据治理</h2>
              </div>
            </header>
            <div className="storage-grid">
              {storageItems.map((item) => (
                <article className="storage-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <div>
                    <i style={{ width: `${item.width}%` }} />
                  </div>
                </article>
              ))}
            </div>
            <div className="data-actions">
              <button className="secondary-action" type="button">
                <Download size={16} />
                导出数据
              </button>
              <button className="secondary-action" type="button">
                <Upload size={16} />
                导入备份
              </button>
            </div>
          </>
        )}

        <footer className="settings-footer">
          <button className="primary-action compact" disabled={saving} onClick={saveAll} type="button">
            <Save size={16} />
            {saving ? "保存中..." : "保存设置"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ToggleRow({
  checked,
  label,
  note,
  onChange,
}: {
  checked: boolean;
  label: string;
  note: string;
  onChange: () => void;
}) {
  return (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>{note}</small>
      </span>
      <input checked={checked} onChange={onChange} type="checkbox" />
    </label>
  );
}
