export type ArchiveFilter = "all" | "active" | "archived";

interface HistoryFilterProps {
  tags: string[];
  activeTag: string;
  archiveFilter: ArchiveFilter;
  onTagChange: (tag: string) => void;
  onArchiveFilterChange: (filter: ArchiveFilter) => void;
}

const archiveOptions: { value: ArchiveFilter; label: string }[] = [
  { value: "all", label: "全部会话" },
  { value: "active", label: "未归档" },
  { value: "archived", label: "已归档" },
];

export function HistoryFilter({
  tags,
  activeTag,
  archiveFilter,
  onTagChange,
  onArchiveFilterChange,
}: HistoryFilterProps) {
  return (
    <section className="tag-filter-row" aria-label="历史筛选">
      {archiveOptions.map((option) => (
        <button
          className={option.value === archiveFilter ? "active" : ""}
          key={option.value}
          onClick={() => onArchiveFilterChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
      <span className="filter-divider" />
      {tags.map((tag) => (
        <button
          className={tag === activeTag ? "active" : ""}
          key={tag}
          onClick={() => onTagChange(tag)}
          type="button"
        >
          {tag}
        </button>
      ))}
    </section>
  );
}
