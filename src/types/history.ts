export type HistoryItem = {
  id: string;
  title: string;
  model: string;
  scope: string;
  messageCount: number;
  tokenUsage: number;
  lastActive: string;
  starred: boolean;
  tags: string[];
  preview: string;
};
