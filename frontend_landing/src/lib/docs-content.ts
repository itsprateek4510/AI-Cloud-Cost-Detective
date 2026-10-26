import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { docsNav, type DocItem } from "./docs-nav";

const DOCS_DIR = join(process.cwd(), "src", "app", "(docs)", "docs");

export type DocIndexEntry = DocItem & { text: string };

function findDocFiles(dir: string, found: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      findDocFiles(full, found);
    } else if (entry === "page.mdx") {
      found.push(full);
    }
  }
  return found;
}

function slugFor(file: string): string {
  const rel = relative(DOCS_DIR, file).split(sep).slice(0, -1).join("/");
  return rel === "" ? "overview" : rel;
}

function toPlainText(mdx: string): string {
  return mdx
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^import\s.+$/gm, " ")
    .replace(/^export\s.+$/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/[#>*_`[\]()|!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDocsIndex(): DocIndexEntry[] {
  let files: string[] = [];
  try {
    files = findDocFiles(DOCS_DIR);
  } catch {
    files = [];
  }
  const text = new Map<string, string>();
  for (const file of files) {
    try {
      text.set(slugFor(file), toPlainText(readFileSync(file, "utf8")));
    } catch {
      // A missing or unreadable file should never break the page.
    }
  }
  return docsNav.map((doc) => ({ ...doc, text: text.get(doc.slug) ?? "" }));
}
