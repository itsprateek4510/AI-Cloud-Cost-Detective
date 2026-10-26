import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getDocsIndex } from "@/lib/docs-content";
import { DocsHelpful } from "./docs-helpful";
import { DocsNav } from "./docs-nav";
import { DocsSearch } from "./docs-search";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const index = getDocsIndex();

  return (
    <div className="docs">
      <header className="docs-topbar">
        <div className="docs-topbar-inner">
          <Link className="docs-brand" href="/">
            <span className="docs-brand-name">CloudLedger</span>
            <span className="docs-brand-tag">Guide</span>
          </Link>
          <DocsSearch index={index} />
          <Link className="docs-back" href="/app">
            <ArrowLeft size={16} aria-hidden /> Back to app
          </Link>
        </div>
      </header>

      <div className="docs-body">
        <aside className="docs-sidebar">
          <DocsNav />
        </aside>
        <main className="docs-content" id="main">
          <article className="docs-prose">{children}</article>
          <DocsHelpful />
        </main>
      </div>
    </div>
  );
}
