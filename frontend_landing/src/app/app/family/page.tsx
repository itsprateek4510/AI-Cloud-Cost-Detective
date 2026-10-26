"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Chat } from "@/components/ecosystem/chat";
import { People } from "@/components/ecosystem/people";
import { Circles } from "@/components/ecosystem/circles";
import { useApp } from "@/components/ecosystem/provider";
import { copyFor } from "@/lib/i18n";

export default function FamilyPage() {
  const { user } = useApp();
  const copy = copyFor(user.locale);
  const params = useSearchParams();
  const requested = params.get("view");
  const tabs = [
    { key: "people", label: copy.family.people, href: "/app/family?view=people" },
    { key: "chat", label: copy.family.chat, href: "/app/family?view=chat" },
    ...(user.advanced_mode
      ? [{ key: "groups", label: copy.family.groups, href: "/app/family?view=groups" }]
      : []),
  ];
  const current = tabs.some((tab) => tab.key === requested) ? requested! : "chat";
  return (
    <>
      <nav className="hub-tabs" aria-label="Family sections">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current === tab.key ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {current === "people" ? (
        <People />
      ) : current === "groups" ? (
        <Circles />
      ) : (
        <Chat kind="family" />
      )}
    </>
  );
}
