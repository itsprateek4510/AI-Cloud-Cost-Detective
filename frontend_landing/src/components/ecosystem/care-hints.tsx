"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";

type Hint = { id: string; text: string; why: string; recipient?: string };
export function CareHints({
  onPlan,
  spaceId,
}: {
  onPlan: (text: string) => void;
  spaceId?: string;
}) {
  const cache = useQueryClient();
  const hints = useQuery({
    queryKey: ["hints"],
    queryFn: () =>
      request<{ incoming: Hint[]; outgoing: Hint[]; reflections?: { id: string }[] }>("/v1/hints"),
    refetchInterval: 60000,
  });
  const remember = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const memory = await request<{ id: string }>("/v1/memories", {
        method: "POST",
        body: JSON.stringify({ space_id: spaceId, summary: text, evidence: text }),
      });
      await request(`/v1/memories/${memory.id}/confirm`, { method: "POST" });
      await request(`/v1/notifications/${id}/read`, { method: "POST" });
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["hints"] });
      void cache.invalidateQueries({ queryKey: ["memories"] });
    },
  });
  const action = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      request(`/v1/hints/${id}`, { method: "POST", body: JSON.stringify({ action }) }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["hints"] });
      void cache.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  return (
    <section className="sc-care-hints" aria-label="Gentle family ideas">
      {hints.data?.outgoing.map((h) => (
        <article className="eco-card" key={h.id}>
          <p>Want me to pass this to {h.recipient} as a gentle idea? They won’t see our chat.</p>
          <p>{h.text}</p>
          {[
            ["yes", "Yes"],
            ["later", "Not now"],
            ["never", "Never for this"],
          ].map(([value, label]) => (
            <button
              key={value}
              disabled={action.isPending}
              onClick={() => action.mutate({ id: h.id, action: value })}
            >
              {label}
            </button>
          ))}
        </article>
      ))}
      {hints.data?.incoming.map((h) => (
        <article className="eco-card" key={h.id}>
          <p>{h.text}</p>
          <details>
            <summary>Why?</summary>
            {h.why}
          </details>
          <button onClick={() => onPlan(`Help me plan this: ${h.text}`)}>Plan it</button>
          {[
            ["sunday", "Remind me Sunday"],
            ["later", "Not now"],
            ["acted", "We did it"],
          ].map(([value, label]) => (
            <button
              key={value}
              disabled={action.isPending}
              onClick={() => action.mutate({ id: h.id, action: value })}
            >
              {label}
            </button>
          ))}
        </article>
      ))}
      {action.error && <p role="alert">{action.error.message}</p>}
      {hints.data?.reflections?.map((reflection) => (
        <form
          className="eco-card"
          key={reflection.id}
          onSubmit={(e) => {
            e.preventDefault();
            remember.mutate({
              id: reflection.id,
              text: String(new FormData(e.currentTarget).get("memory")),
            });
          }}
        >
          <label>
            What is one moment from your time together you would like to remember?
            <input name="memory" required maxLength={1000} />
          </label>
          <button disabled={!spaceId || remember.isPending}>Save this memory privately</button>
          <p>You can choose to share it with family from the Memory screen.</p>
        </form>
      ))}
      {remember.error && <p role="alert">{remember.error.message}</p>}
    </section>
  );
}
