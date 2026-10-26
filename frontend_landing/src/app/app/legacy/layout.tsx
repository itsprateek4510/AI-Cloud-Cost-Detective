import type { ReactNode } from "react";
import { AdvancedGate } from "@/components/ecosystem/advanced-gate";
import "./legacy.css";

export default function LegacyLayout({ children }: { children: ReactNode }) {
  return <AdvancedGate feature="heritage">{children}</AdvancedGate>;
}
