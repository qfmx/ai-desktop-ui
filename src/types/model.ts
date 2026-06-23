export type ProtocolType = "openai-compatible" | "anthropic" | "ollama";

export type ProviderType = "cloud" | "local" | "custom";

export type ModelConfig = {
  id: string;
  name: string;
  displayName: string;
  modelName: string;
  providerId: string;
  provider: string;
  context: string;
  maxOutput: number;
  temperature: number;
  active: boolean;
  capabilities: string[];
};

export type Provider = {
  id: string;
  name: string;
  type: ProviderType;
  providerType: ProviderType;
  protocolType: ProtocolType;
  status: string;
  endpoint: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  models: ModelConfig[];
};

export type ProviderForm = {
  id: string;
  name: string;
  provider_type: ProviderType;
  protocol_type: ProtocolType;
  base_url: string;
  api_key: string;
  auto_sync_models: boolean;
};

export type ChatModelOption = {
  providerId: string;
  providerName: string;
  protocolType: ProtocolType;
  modelConfigId: string;
  displayName: string;
  modelName: string;
};

export type ChatModelGroup = {
  provider_id: string;
  provider_name: string;
  provider_type: ProviderType;
  protocol_type: ProtocolType;
  models: {
    model_config_id: string;
    display_name: string;
    model_name: string;
  }[];
};

export const initialProviderForm: ProviderForm = {
  id: "",
  name: "",
  provider_type: "cloud",
  protocol_type: "openai-compatible",
  base_url: "https://api.openai.com/v1",
  api_key: "",
  auto_sync_models: true,
};
