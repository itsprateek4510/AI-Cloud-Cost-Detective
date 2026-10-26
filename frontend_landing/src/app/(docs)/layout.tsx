import type { Metadata } from "next";

import { DocsShell } from "@/components/docs/docs-shell";
import "./docs.css";

export const metadata: Metadata = {
  title: "CloudLedger guide",
  description: "Learn how to connect a cloud account, review cost findings, and read the weekly summary.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
