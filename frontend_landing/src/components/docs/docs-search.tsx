"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import type { DocIndexEntry } from "@/lib/docs-content";

type Match = DocIndexEntry & { snippet: string };

function makeSnippet(text: string, query: string) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return "";
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, at + query.length + 90);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? <mark key={index}>{part}</mark> : part,
      )}
    </>
  );
}

export function DocsSearch({ index }: { index: DocIndexEntry[] }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const matches = useMemo<Match[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return index
      .filter((doc) =>
        `${doc.title} ${doc.description} ${doc.group} ${doc.text}`.toLowerCase().includes(q),
      )
      .slice(0, 8)
      .map((doc) => ({ ...doc, snippet: makeSnippet(doc.text, q) }));
  }, [index, query]);

  const open = focused && query.trim().length >= 2;

  return (
    <div className="docs-search">
      <div className="docs-search-field">
        <Search size={16} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          onKeyDown={(event) => event.key === "Escape" && setQuery("")}
          placeholder="Search the guide"
          aria-label="Search the guide"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
            <X size={15} aria-hidden />
          </button>
        )}
      </div>

      {open && (
        <div className="docs-search-results" role="listbox" aria-label="Search results">
          {matches.length === 0 ? (
            <p className="docs-search-empty">No pages match “{query.trim()}”.</p>
          ) : (
            <ul>
              {matches.map((doc) => (
                <li key={doc.href}>
                  <Link href={doc.href} onClick={() => setQuery("")}>
                    <span className="docs-search-title">
                      <Highlight text={doc.title} query={query.trim()} />
                      <em>{doc.group}</em>
                    </span>
                    <span className="docs-search-snippet">
                      {doc.snippet ? (
                        <Highlight text={doc.snippet} query={query.trim()} />
                      ) : (
                        doc.description
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
