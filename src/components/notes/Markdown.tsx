import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tiny, dependency-free markdown renderer. Supports a safe subset:
 *   ## Heading        -> bold heading
 *   **bold**          -> <strong>
 *   *italic*          -> <em>
 *   `code`            -> inline mono
 *   > blockquote      -> lime-left-bordered muted block
 *   - bullet          -> bullet list
 *   blank line        -> paragraph break / line breaks
 *
 * Builds React elements directly — never injects raw HTML.
 */

/* ---------- Inline parsing (**bold**, *italic*, `code`) ---------- */

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Match the four inline token kinds in priority order.
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const key = `${keyPrefix}-${i++}`;
    if (match[1] != null) {
      nodes.push(<strong key={key} className="font-bold">{match[2]}</strong>);
    } else if (match[3] != null) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        >
          {match[4]}
        </code>,
      );
    } else if (match[5] != null) {
      nodes.push(<em key={key} className="italic">{match[6]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/* ---------- Block parsing ---------- */

type Block =
  | { type: "heading"; text: string }
  | { type: "quote"; lines: string[] }
  | { type: "list"; items: string[] }
  | { type: "para"; lines: string[] };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      blocks.push({ type: "heading", text: trimmed.replace(/^#{1,6}\s+/, "") });
      i++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const lines2: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        lines2.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", lines: lines2 });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Paragraph: gather consecutive plain lines.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*]\s+/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "para", lines: para });
  }
  return blocks;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source ?? "");
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-foreground", className)}>
      {blocks.map((b, bi) => {
        if (b.type === "heading") {
          return (
            <h2 key={bi} className="pt-1 text-xl font-bold text-foreground">
              {parseInline(b.text, `h-${bi}`)}
            </h2>
          );
        }
        if (b.type === "quote") {
          return (
            <blockquote
              key={bi}
              className="rounded-r-xl border-l-4 border-primary bg-muted/60 px-4 py-3 text-foreground"
            >
              {b.lines.map((l, li) => (
                <p key={li} className={li ? "mt-1" : undefined}>
                  {parseInline(l, `q-${bi}-${li}`)}
                </p>
              ))}
            </blockquote>
          );
        }
        if (b.type === "list") {
          return (
            <ul key={bi} className="ml-1 space-y-1">
              {b.items.map((it, li) => (
                <li key={li} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{parseInline(it, `l-${bi}-${li}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="text-muted-foreground">
            {b.lines.map((l, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {parseInline(l, `p-${bi}-${li}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Strip markdown tokens to a plain one-line preview (for list cards). */
export function markdownPreview(source: string | null | undefined): string {
  if (!source) return "";
  const firstContentLine =
    source
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  return firstContentLine
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}
