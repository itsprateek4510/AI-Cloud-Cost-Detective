"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";

export function HelpLink({ className, label = "Help and guide" }: { className?: string; label?: string }) {
  return (
    <Link className={className ?? "help-link"} href="/docs" aria-label={label} title={label}>
      <HelpCircle size={18} />
    </Link>
  );
}
