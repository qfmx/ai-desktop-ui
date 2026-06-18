import { type FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

import type { Provider, ProviderForm } from "../types/model";
import { initialProviderForm } from "../types/model";

import { ModelSummary } from "../components/model/ModelSummary";
import { ProviderPanel } from "../components/model/ProviderPanel";
import { ModelTable } from "../components/model/ModelTable";
import { ModelConfigGrids } from "../components/model/ModelConfigGrids";

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
  const [savingSettings, setSavingSettings] = useState(false);
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
    void Promise.all([
      loadProviders(),
      api.settings.get().then((settings) => {
        setTemperature(settings.default_temperature ?? 0.4);
        setTopK(settings.default_top_k ?? 8);
        setSafetyFilter(settings.masking_enabled ?? true);
        setFallback(settings.model_fallback_enabled ?? true);
        setTrace(settings.trace_enabled ?? settings.audit_enabled ?? true);
      }),
    ]);
  }, [backendOk]);

  const allModels = useMemo(() => providers.flatMap((p) => p.models), [providers]);
  const activeModels = allModels.filter((m) => m.active).length;
  const currentProvider = providers.find((p) => p.id === selectedProvider) ?? providers[0];
  const availability = useMemo(() => {
    if (!providers.length) return 0;
    const score = providers.reduce((sum, provider) => {
      if (provider.status === "connected") return sum + 100;
      if (provider.status === "limited") return sum + 65;
      return sum;
    }, 0);
    return score / providers.length;
  }, [providers]);

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

  const saveModelSettings = async () => {
    setSavingSettings(true);
    setError("");
    setNotice("");
    try {
      await api.settings.save({
        default_temperature: temperature,
        default_top_k: topK,
        masking_enabled: safetyFilter,
        model_fallback_enabled: fallback,
        trace_enabled: trace,
      });
      setNotice("模型默认参数已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存模型默认参数失败");
    } finally {
      setSavingSettings(false);
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
      <ModelSummary
        providersCount={providers.length}
        activeModelsCount={activeModels}
        allModelsCount={allModels.length}
        availability={availability}
      />

      {(error || notice) && (
        <section className="page-toolbar" style={{ borderColor: error ? "rgba(244, 63, 94, 0.35)" : "rgba(34, 197, 94, 0.25)" }}>
          <span style={{ color: error ? "#fda4af" : "#86efac" }}>{error || notice}</span>
        </section>
      )}

      <div className="model-layout">
        <ProviderPanel
          providers={providers}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProvider}
          loadingProviders={loadingProviders}
          showProviderForm={showProviderForm}
          setShowProviderForm={setShowProviderForm}
          providerForm={providerForm}
          setProviderForm={setProviderForm}
          creatingProvider={creatingProvider}
          handleCreateProvider={handleCreateProvider}
        />

        <section className="model-config-panel">
          <ModelTable
            currentProvider={currentProvider}
            testingProviderId={testingProviderId}
            syncingProviderId={syncingProviderId}
            testConnection={testConnection}
            syncModels={syncModels}
            toggleModel={toggleModel}
          />

          <ModelConfigGrids
            temperature={temperature}
            setTemperature={setTemperature}
            topK={topK}
            setTopK={setTopK}
            safetyFilter={safetyFilter}
            setSafetyFilter={setSafetyFilter}
            fallback={fallback}
            setFallback={setFallback}
            trace={trace}
            setTrace={setTrace}
            currentProvider={currentProvider}
            allModels={allModels}
            providers={providers}
            savingSettings={savingSettings}
            onSaveSettings={saveModelSettings}
          />
        </section>
      </div>
    </div>
  );
}
