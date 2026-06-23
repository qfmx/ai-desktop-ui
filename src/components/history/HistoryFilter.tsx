export type ArchiveFilter = "all" | "active" | "archived";

interface HistoryFilterProps {
  tags: string[];
  selectedTags: string[];
  archiveFilter: ArchiveFilter;
  onTagToggle: (tag: string) => void;
  onClearTags: () => void;
  onArchiveFilterChange: (filter: ArchiveFilter) => void;
}

const archiveOptions: { value: ArchiveFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "active", label: "未归档" },
  { value: "archived", label: "已归档" },
];

export function HistoryFilter({
  tags,
  selectedTags,
  archiveFilter,
  onTagToggle,
  onClearTags,
  onArchiveFilterChange,
}: HistoryFilterProps) {
  return (
    <section className="history-filter-panel" aria-label="历史筛选">
      <div className="history-filter-group">
        <span className="history-filter-label">状态</span>
        <div className="history-segmented-control" role="radiogroup" aria-label="归档状态">
          {archiveOptions.map((option) => (
            <button
              aria-checked={option.value === archiveFilter}
              className={option.value === archiveFilter ? "active" : ""}
              key={option.value}
              onClick={() => onArchiveFilterChange(option.value)}
              role="radio"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="history-filter-group history-tag-filter-group">
        <div className="history-filter-heading">
          <span className="history-filter-label">标签</span>
          {selectedTags.length > 0 && (
            <button className="history-clear-tags" onClick={onClearTags} type="button">
              清空
            </button>
          )}
        </div>
        <div className="history-tag-filter" aria-label="标签筛选">
          {tags.length === 0 ? (
            <span className="history-empty-tags">暂无标签</span>
          ) : (
            tags.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <button
                  aria-pressed={selected}
                  className={selected ? "active" : ""}
                  key={tag}
                  onClick={() => onTagToggle(tag)}
                  type="button"
                >
                  {tag}
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
