import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { AccessRule, KnowledgeBase, KnowledgeStats } from "../types/knowledge";
import { KnowledgeSummary } from "../components/knowledge/KnowledgeSummary";
import { KnowledgeToolbar } from "../components/knowledge/KnowledgeToolbar";
import { KnowledgeList } from "../components/knowledge/KnowledgeList";
import { PermissionMatrix } from "../components/knowledge/PermissionMatrix";

export default function KnowledgePage() {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState("");
  const [backendOk, setBackendOk] = useState(false);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);

  useEffect(() => {
    api.health()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  useEffect(() => {
    if (!backendOk) return;
    void Promise.all([
      api.knowledge.bases(),
      api.knowledge.stats(),
      api.knowledge.accessMatrix(),
    ]).then(([list, nextStats, matrix]) => {
      setBases(
        list.map((b: any) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          documents: b.documents ?? 0,
          chunks: b.chunks ?? 0,
          size: b.size || "—",
          status: b.status || "ready",
          owner: b.owner || "",
          updatedAt: b.updated_at || "",
          embedding: b.embedding_model || "",
          health: b.health ?? 0,
          tags: typeof b.tags === "string" ? JSON.parse(b.tags) : b.tags || [],
        }))
      );
      setStats(nextStats);
      setAccessRules(matrix);
      if (list.length > 0) setSelectedId(list[0].id);
    });
  }, [backendOk]);

  const filteredBases = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return bases;
    return bases.filter((base) =>
      [base.name, base.description, base.owner, ...base.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [query, bases]);

  if (!backendOk) {
    return (
      <div className="workspace-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <p style={{ opacity: 0.6 }}>正在连接后端服务...</p>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <KnowledgeSummary bases={bases} stats={stats} policyCount={accessRules.length} />

      <KnowledgeToolbar
        query={query}
        onQueryChange={setQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <KnowledgeList
        bases={filteredBases}
        selectedId={selectedId}
        onSelect={setSelectedId}
        viewMode={viewMode}
      />

      <PermissionMatrix rules={accessRules.filter((rule) => filteredBases.some((base) => base.id === rule.id))} />
    </div>
  );
}
