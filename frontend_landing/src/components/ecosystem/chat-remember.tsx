"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Sparkles, X } from "lucide-react";
import { request } from "@/lib/api";
import type { Memory } from "@/lib/domain";

/**
 * The smallest possible consent step: Smriti offers one memory at a time,
 * with the source quote still visible. Nothing is saved unless the owner says
 * yes, and Edit keeps the correction path one tap away.
 */
export function RememberCard({ memory }: { memory: Memory }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(memory.summary);
  const action = useMutation({
    mutationFn: async (choice: "yes" | "edit" | "no") => {
      if (choice === "no") {
        return request(`/v1/memories/${memory.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "rejected", version: memory.version }),
        });
      }
      if (choice === "edit") {
        await request(`/v1/memories/${memory.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            summary: summary.trim(),
            version: memory.version,
            reason: "Edited before saving",
          }),
        });
      }
      return request(`/v1/memories/${memory.id}/confirm`, { method: "POST" });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["memories"] });
      void client.invalidateQueries({ queryKey: ["home"] });
      setEditing(false);
    },
  });

  return (
    <article className="sc-remember" aria-label="Remember this?">
      <span className="sc-remember-kicker">
        <Sparkles size={14} />
        Remember this?
      </span>
      {editing ? (
        <textarea
          className="sc-remember-edit"
          aria-label="Edit this memory"
          value={summary}
          maxLength={500}
          rows={3}
          onChange={(event) => setSummary(event.target.value)}
        />
      ) : (
        <p className="sc-remember-summary">{memory.summary}</p>
      )}
      {!!memory.sources?.[0]?.quote && !editing && (
        <blockquote>“{memory.sources[0].quote}”</blockquote>
      )}
      <div className="sc-remember-actions">
        {editing ? (
          <>
            <button
              type="button"
              className="sc-remember-yes"
              disabled={!summary.trim() || action.isPending}
              onClick={() => action.mutate("edit")}
            >
              <Check size={14} />
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="sc-remember-yes"
              disabled={action.isPending}
              onClick={() => action.mutate("yes")}
            >
              <Check size={14} />
              Yes
            </button>
            <button type="button" disabled={action.isPending} onClick={() => setEditing(true)}>
              <Pencil size={13} />
              Edit
            </button>
            <button type="button" disabled={action.isPending} onClick={() => action.mutate("no")}>
              <X size={14} />
              No
            </button>
          </>
        )}
      </div>
      {action.error && (
        <p className="sc-remember-error" role="alert">
          {action.error.message}
        </p>
      )}
    </article>
  );
}
