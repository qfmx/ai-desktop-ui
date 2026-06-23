export type HistoryItem = {
  id: string;
  title: string;
  model: string;
  scope: string;
  messageCount: number;
  tokenUsage: number;
  lastActive: string;
  starred: boolean;
  archived: boolean;
  archivedAt: string;
  tags: string[];
  preview: string;
};
