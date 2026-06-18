export type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  documents: number;
  chunks: number;
  size: string;
  status: "ready" | "syncing" | "warning";
  owner: string;
  updatedAt: string;
  embedding: string;
  health: number;
  tags: string[];
};

export type KnowledgeStats = {
  bases: number;
  documents: number;
  chunks: number;
  vector_dim: number;
};

export type AccessRule = {
  id: string;
  name: string;
  owner: string;
  roles: string[];
  policy: string;
};

export const statusMap: Record<string, string> = {
  ready: "可用",
  syncing: "同步中",
  warning: "需复核",
};
