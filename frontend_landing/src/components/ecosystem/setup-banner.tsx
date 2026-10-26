"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";

type Check = { ok: boolean; detail: string };
type Readiness = { status: "ok" | "degraded"; checks: Record<string, Check> };

const DEV = process.env.NODE_ENV === "development";
const STORAGE_KEY = "smriti-setup-banner-dismissed";

export function SetupBanner() {
  const [dismissed, setDismissed] = useState(false);
  const readiness = useQuery({
    queryKey: ["readiness"],
    queryFn: async (): Promise<Readiness> => {
      const response = await fetch("/health/ready", { cache: "no-store" });
      return (await response.json()) as Readiness;
    },
    enabled: DEV,
    retry: false,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
  }, []);

  if (!DEV || dismissed) return null;
  const failed = readiness.data
    ? Object.entries(readiness.data.checks)
        .filter(([, check]) => !check.ok)
        .map(([name]) => name.replaceAll("_", " "))
    : [];
  if (readiness.isPending) return null;
  if (!readiness.isError && readiness.data?.status === "ok") return null;

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="setup-banner" role="status" aria-live="polite">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>Setup needed</strong>
        <span>
          {readiness.isError
            ? "The setup check could not reach the API."
            : `Not ready: ${failed.join(", ") || "an unknown service"}.`}
        </span>
      </div>
      <button onClick={() => void readiness.refetch()}>Try again</button>
      <button className="setup-banner-close" onClick={dismiss} aria-label="Dismiss setup banner">
        <X size={16} />
      </button>
    </div>
  );
}
