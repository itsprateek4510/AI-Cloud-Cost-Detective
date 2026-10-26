"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Users, Mic, Menu, LogOut } from "lucide-react";
import { Logo } from "../ui";
import { HelpLink } from "../docs/help-link";
import { logout } from "@/lib/api";
import { useApp } from "./provider";
import { NotificationBell } from "./notification-bell";
import { LanguageToggle } from "./language-toggle";
import { AppNavigation, HeritageNavigation, MobileTabBar } from "./navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, spaces, space, family, setSpace } = useApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  const router = useRouter();
  async function signOut() {
    try {
      await logout();
      client.clear();
      localStorage.removeItem("smriti-workspace-v1");
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (path === "/app" || path === "/app/me") return <>{children}</>;
  const legacy = path.startsWith("/app/legacy");
  return (
    <div
      className={`ecosystem ${space?.type === "personal" ? "eco-private" : "eco-shared"}${
        legacy ? " eco-legacy" : ""
      }`}
    >
      <button
        className="eco-mobile"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Toggle navigation"
      >
        <Menu />
      </button>
      <aside className={`eco-sidebar ${open ? "eco-open" : ""}`}>
        <Logo />
        <span className="eco-kicker">YOUR LIVING ARCHIVE</span>
        <label className="eco-switcher">
          Current space
          <select
            aria-label="Current space"
            value={space?.id ?? ""}
            onChange={(e) => setSpace(e.target.value)}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type === "personal" ? "🔒" : "◉"} {s.name}
              </option>
            ))}
          </select>
        </label>
        <AppNavigation onNavigate={() => setOpen(false)} />
        <div className="eco-sidebar-bottom">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
          <button onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </aside>
      <div className="eco-main">
        <header className="eco-topbar">
          <NotificationBell />
          <LanguageToggle />
          <HelpLink label="Help and guide" />
          <span>
            {legacy ? (
              <>Family archive · {family?.name ?? "No family yet"}</>
            ) : (
              <>
                <VisibilityBadge
                  personal={space?.type === "personal"}
                  label={space?.type === "personal" ? "Personal workspace" : "Shared workspace"}
                />{" "}
                {space?.name}
              </>
            )}
          </span>
          <Link className="eco-topbar-action" href="/app/record">
            <Mic size={16} /> Record a memory
          </Link>
        </header>
        {legacy && <HeritageNavigation />}
        <main id="main" className="eco-content">
          {children}
        </main>
        <footer className="eco-footer">Your memories. Your audience. Always your choice.</footer>
      </div>
      <MobileTabBar />
    </div>
  );
}

export function VisibilityBadge({
  personal = true,
  label,
}: {
  personal?: boolean;
  label?: string;
}) {
  return (
    <span className={`eco-badge ${personal ? "eco-lock" : "eco-warm"}`}>
      {personal ? <LockKeyhole size={12} /> : <Users size={12} />}
      {label ?? (personal ? "Only you" : "Shared space")}
    </span>
  );
}
