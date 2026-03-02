"use client";

import type { Message } from "ai";
import { useMemo } from "react";

/** Minimal markdown renderer: bold, italic, inline code, bullet lists, numbered lists, tables */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let tableRows: string[][] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag
          key={key++}
          className={
            listType === "ul"
              ? "list-disc pl-5 my-1 space-y-0.5"
              : "list-decimal pl-5 my-1 space-y-0.5"
          }
        >
          {listItems.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1);
      elements.push(
        <div key={key++} className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                {header.map((cell, i) => (
                  <th key={i} className="text-left py-1.5 px-2 font-semibold text-primary">
                    {formatInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-cream/50" : ""}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-1.5 px-2 text-primary/80">
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  for (const line of lines) {
    const ulMatch = line.match(/^[-*•]\s+(.+)/);
    const olMatch = line.match(/^\d+[.)]\s+(.+)/);
    const tableMatch = line.match(/^\|(.+)\|$/);
    const isSeparator = /^\|[\s:|-]+\|$/.test(line.trim());

    if (tableMatch && !isSeparator) {
      flushList();
      const cells = tableMatch[1].split("|").map((c) => c.trim());
      tableRows.push(cells);
    } else if (isSeparator) {
      // Skip markdown table separator row
    } else {
      flushTable();

      if (ulMatch) {
        if (listType !== "ul") flushList();
        listType = "ul";
        listItems.push(ulMatch[1]);
      } else if (olMatch) {
        if (listType !== "ol") flushList();
        listType = "ol";
        listItems.push(olMatch[1]);
      } else {
        flushList();
        if (line.trim() === "") {
          elements.push(<br key={key++} />);
        } else {
          elements.push(
            <p key={key++} className="my-0.5">
              {formatInline(line)}
            </p>
          );
        }
      }
    }
  }
  flushList();
  flushTable();

  return <>{elements}</>;
}

/** Format inline markdown: **bold**, *italic*, `code` */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      parts.push(
        <strong key={i++} className="font-semibold text-primary">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(<em key={i++}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code
          key={i++}
          className="bg-cream text-primary px-1 py-0.5 rounded text-xs font-mono border border-border"
        >
          {match[4]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  // Skip empty assistant messages (tool call steps)
  if (!isUser && !message.content) return null;

  const rendered = useMemo(
    () => (isUser ? message.content : renderMarkdown(message.content)),
    [message.content, isUser]
  );

  if (isUser) {
    return (
      <div className="flex gap-3 max-w-2xl ml-auto flex-row-reverse">
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">You</span>
        </div>
        <div className="bg-primary text-white p-4 rounded-lg rounded-tr-none">
          <p className="text-sm leading-relaxed">{rendered}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-3xl">
      <div className="size-8 rounded-lg bg-cream border border-border flex items-center justify-center shrink-0">
        <span className="text-primary text-xs font-bold">AI</span>
      </div>
      <div className="ai-bubble p-5 rounded-lg rounded-tl-none">
        <div className="text-sm leading-relaxed text-primary/90 prose-fleet">
          {rendered}
        </div>
      </div>
    </div>
  );
}
