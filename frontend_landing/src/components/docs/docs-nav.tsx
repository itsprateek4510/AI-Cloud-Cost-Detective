"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docGroups, docsNav } from "@/lib/docs-nav";

export function DocsNav() {
  const path = usePathname();
  const groups = docGroups.map((group) => ({
    group,
    items: docsNav.filter((doc) => doc.group === group),
  }));

  return (
    <nav className="docs-nav" aria-label="Guide">
      {groups.map(({ group, items }) => (
        <div className="docs-nav-group" key={group}>
          <p className="docs-nav-title">{group}</p>
          <ul>
            {items.map((doc) => (
              <li key={doc.href}>
                <Link
                  href={doc.href}
                  aria-current={path === doc.href ? "page" : undefined}
                  className={path === doc.href ? "docs-nav-active" : undefined}
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
