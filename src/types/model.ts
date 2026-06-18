export type ModelConfig = {
  id: string;
  name: string;
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
  type: "cloud" | "local";
  status: string;
  endpoint: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  models: ModelConfig[];
};

export type ProviderForm = {
  id: string;
  name: string;
  type: "cloud" | "local";
  endpoint: string;
  api_key: string;
  auto_sync_models: boolean;
};

export const initialProviderForm: ProviderForm = {
  id: "",
  name: "",
  type: "cloud",
  endpoint: "https://api.openai.com/v1",
  api_key: "",
  auto_sync_models: true,
};
