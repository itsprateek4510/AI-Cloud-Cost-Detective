"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { useApp } from "./provider";

export function LanguageToggle() {
  const { user } = useApp();
  const client = useQueryClient();
  const locale = user.locale === "hi" ? "hi" : "en";
  const change = useMutation({
    mutationFn: (next: "en" | "hi") =>
      request("/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ locale: next }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["me"] }),
  });
  return (
    <div className="language-toggle" role="group" aria-label="Language">
      <button
        type="button"
        aria-pressed={locale === "en"}
        disabled={change.isPending}
        onClick={() => change.mutate("en")}
      >
        EN
      </button>
      <button
        type="button"
        aria-pressed={locale === "hi"}
        disabled={change.isPending}
        onClick={() => change.mutate("hi")}
        lang="hi"
      >
        हिं
      </button>
      {change.error && (
        <span role="alert" title={change.error.message}>
          !
        </span>
      )}
    </div>
  );
}
