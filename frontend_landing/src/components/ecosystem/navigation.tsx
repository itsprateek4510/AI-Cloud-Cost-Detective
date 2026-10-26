"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Settings, Users } from "lucide-react";
import { copyFor } from "@/lib/i18n";
import { useApp } from "./provider";

const destinations = [
  { href: "/app", label: "Home", icon: Home, match: ["/app", "/app/me", "/app/ask"] },
  {
    href: "/app/family",
    label: "Family",
    icon: Users,
    match: ["/app/family", "/app/people", "/app/circles"],
  },
  {
    href: "/app/stories",
    label: "Stories",
    icon: BookOpen,
    match: ["/app/stories", "/app/memory", "/app/recordings", "/app/record", "/app/shared"],
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: Settings,
    match: ["/app/settings", "/app/prompts", "/app/activity", "/app/legacy"],
  },
];

function isCurrent(path: string, href: string) {
  const destination = destinations.find((item) => item.href === href);
  if (!destination) return path === href;
  return destination.match.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function AppNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { user } = useApp();
  const copy = copyFor(user.locale);
  return (
    <nav className="app-navigation" aria-label="App navigation">
      {destinations.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={isCurrent(path, href) ? "page" : undefined}
        >
          <Icon size={18} />
          {copy.nav[label.toLowerCase() as keyof typeof copy.nav]}
        </Link>
      ))}
    </nav>
  );
}

export function MobileTabBar() {
  const path = usePathname();
  const { user } = useApp();
  const copy = copyFor(user.locale);
  return (
    <nav className="mobile-tab-bar" aria-label="Main navigation">
      {destinations.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isCurrent(path, href) ? "page" : undefined}
        >
          <Icon size={20} />
          <span>{copy.nav[label.toLowerCase() as keyof typeof copy.nav]}</span>
        </Link>
      ))}
    </nav>
  );
}

export function HeritageNavigation() {
  const path = usePathname();
  const links = [
    ["/app/legacy", "Overview"],
    ["/app/legacy/interviews", "Interviews"],
    ["/app/legacy/timeline", "Timeline"],
    ["/app/legacy/vault", "Documents & photos"],
    ["/app/legacy/founders", "Founder stories"],
    ["/app/legacy/books", "Family books"],
    ["/app/legacy/assistant", "Ask the archive"],
  ];
  return (
    <nav className="heritage-navigation" aria-label="Heritage navigation">
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            path === href || (href !== "/app/legacy" && path.startsWith(`${href}/`))
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
