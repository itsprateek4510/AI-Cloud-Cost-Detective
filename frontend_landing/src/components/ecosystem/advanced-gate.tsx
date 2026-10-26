"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { useApp } from "./provider";

export function AdvancedGate({
  children,
  feature = "advanced",
}: {
  children: React.ReactNode;
  feature?: "advanced" | "heritage" | "groups";
}) {
  const { user } = useApp();
  const router = useRouter();
  const heritageAvailable = user.feature_heritage !== false;
  const allowed =
    user.advanced_mode && (feature !== "heritage" || heritageAvailable);
  const notice = feature === "heritage" && !heritageAvailable ? "heritage-off" : "advanced";

  useEffect(() => {
    if (!allowed) router.replace(`/app?notice=${notice}`);
  }, [allowed, notice, router]);

  if (allowed) return children;

  return (
    <div className="eco-empty">
      <LockKeyhole size={28} />
      <h1>{feature === "heritage" && !heritageAvailable ? "Heritage is unavailable" : "Advanced tools are off"}</h1>
      <p>
        {feature === "heritage" && !heritageAvailable
          ? "This deployment has turned off the heritage studio. Your family stories and memories are still safe."
          : "Heritage studio and Groups are optional. Turn on Advanced tools in Settings when you want them."}
      </p>
      <Link className="eco-primary" href="/app">
        Back to Home
      </Link>
    </div>
  );
}
