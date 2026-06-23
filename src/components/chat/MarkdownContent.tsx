import { Copy } from "lucide-react";
import type { ReactNode } from "react";

type Segment =
  | { type: "markdown"; content: string }
  | { type: "code"; language: string; content: string };

type InlineToken = {
  key: string;
  value: ReactNode;
};

function splitSegments(value: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(value)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: "markdown", content: value.slice(cursor, match.index) });
    }
    segments.push({
      type: "code",
      language: match[1] || "text",
      content: match[2].replace(/\s+$/, ""),
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    segments.push({ type: "markdown", content: value.slice(cursor) });
  }

  return segments.length ? segments : [{ type: "markdown", content: value }];
}

function renderInline(value: string): ReactNode[] {
  const tokens: InlineToken[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      tokens.push({ key: `t-${cursor}`, value: value.slice(cursor, match.index) });
    }

    const raw = match[0];
    if (raw.startsWith("`")) {
      tokens.push({
        key: `c-${match.index}`,
        value: <code className="markdown-inline-code">{raw.slice(1, -1)}</code>,
      });
    } else if (raw.startsWith("**")) {
      tokens.push({
        key: `b-${match.index}`,
        value: <strong>{raw.slice(2, -2)}</strong>,
      });
    } else if (raw.startsWith("*")) {
      tokens.push({
        key: `e-${match.index}`,
        value: <em>{raw.slice(1, -1)}</em>,
      });
    } else {
      const link = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      tokens.push({
        key: `a-${match.index}`,
        value: link ? (
          <a href={safeHref(link[2])} rel="noreferrer" target="_blank">
            {link[1]}
          </a>
        ) : (
          raw
        ),
      });
    }
    cursor = match.index + raw.length;
  }

  if (cursor < value.length) {
    tokens.push({ key: `t-${cursor}`, value: value.slice(cursor) });
  }

  return tokens.map((token) => <span key={token.key}>{token.value}</span>);
}

function safeHref(href: string) {
  return /^(https?:|mailto:|#|\/)/i.test(href) ? href : "#";
}

function isTableDelimiter(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTable(lines: string[], start: number) {
  const header = lines[start];
  const delimiter = lines[start + 1];
  if (!header?.includes("|") || !isTableDelimiter(delimiter || "")) {
    return null;
  }

  const rows: string[][] = [];
  let cursor = start + 2;
  while (cursor < lines.length && lines[cursor].includes("|") && lines[cursor].trim()) {
    rows.push(splitTableRow(lines[cursor]));
    cursor += 1;
  }

  return {
    headers: splitTableRow(header),
    rows,
    next: cursor,
  };
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderHeading(level: number, text: string, key: string) {
  if (level === 1) return <h3 key={key}>{renderInline(text)}</h3>;
  if (level === 2) return <h4 key={key}>{renderInline(text)}</h4>;
  if (level === 3) return <h5 key={key}>{renderInline(text)}</h5>;
  return <h6 key={key}>{renderInline(text)}</h6>;
}

function renderMarkdownBlocks(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      nodes.push(
        <div className="markdown-table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {table.headers.map((header, cellIndex) => (
                  <th key={`${header}-${cellIndex}`}>{renderInline(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      index = table.next;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      nodes.push(renderHeading(heading[1].length, heading[2], `h-${index}`));
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(<blockquote key={`q-${index}`}>{renderInline(quoteLines.join(" "))}</blockquote>);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      nodes.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`${itemIndex}-${item}`}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      nodes.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`${itemIndex}-${item}`}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !parseTable(lines, index) &&
      !/^(#{1,4})\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith(">") &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    nodes.push(<p key={`p-${index}`}>{renderInline(paragraph.join(" "))}</p>);
  }

  return nodes;
}

function copyCode(content: string) {
  void navigator.clipboard?.writeText(content);
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      {splitSegments(content).map((segment, index) => {
        if (segment.type === "code") {
          return (
            <figure className="markdown-code-block" key={`code-${index}`}>
              <figcaption>
                <span>{segment.language}</span>
                <button onClick={() => copyCode(segment.content)} title="复制代码" type="button">
                  <Copy size={14} />
                  复制
                </button>
              </figcaption>
              <pre>
                <code>{segment.content}</code>
              </pre>
            </figure>
          );
        }
        return <div key={`md-${index}`}>{renderMarkdownBlocks(segment.content)}</div>;
      })}
    </div>
  );
}
