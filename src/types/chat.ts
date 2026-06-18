export type Message = {
  id: string;
  role: "user" | "assistant";
  author: string;
  content: string;
  time: string;
  model?: string;
  tokens?: number;
  citations?: string[];
};

export type ChatSession = {
  id: string;
  title: string;
  scope: string;
  model: string;
  messages: Message[];
  tags?: string[];
};

export type QuickAction = {
  title: string;
  prompt: string;
};

export type PipelineStep = {
  label: string;
  value: string;
  tone: string;
};

export type RouteItem = {
  label: string;
  value: string;
  kind: "cpu" | "database" | "workflow";
};

export type RuntimeContext = {
  pipeline: PipelineStep[];
  routing: RouteItem[];
  audit: {
    enabled: boolean;
    title: string;
    description: string;
  };
  scope: string;
  stats?: Record<string, unknown>;
};
