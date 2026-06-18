interface HistoryFilterProps {
  tags: string[];
  activeTag: string;
  onTagChange: (tag: string) => void;
}

export function HistoryFilter({ tags, activeTag, onTagChange }: HistoryFilterProps) {
  return (
    <section className="tag-filter-row" aria-label="历史标签">
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
