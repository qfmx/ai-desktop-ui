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
