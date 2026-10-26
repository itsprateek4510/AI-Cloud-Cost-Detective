"use client";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { Heading, Empty, ErrorState } from "./common";

type Prompt = { id: string; text: string; status: string; reason: string };
type Event = {
  id: string;
  action: string;
  item_type: string;
  created_at: string;
  meta: { reason?: string; level?: string };
};

export function Prompts() {
  const client = useQueryClient();
  const prompts = useQuery({
    queryKey: ["prompts"],
    queryFn: () => request<Prompt[]>("/v1/prompts"),
  });
  const skip = useMutation({
    mutationFn: (id: string) => request(`/v1/prompts/${id}/skip`, { method: "POST" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["prompts"] }),
  });
  return (
    <>
      <Heading
        eyebrow="No rush. Just a question."
        title="Questions for you"
        description="Follow-up questions from your recordings. Record when it feels right, or skip without a second thought."
      />
      <ErrorState error={prompts.error || skip.error} />
      {prompts.isPending ? (
        <p>Opening questions…</p>
      ) : prompts.data?.filter((p) => p.status !== "skipped").length ? (
        prompts.data
          .filter((p) => p.status !== "skipped")
          .map((p) => (
            <article className="eco-card" key={p.id}>
              <span className="eco-eyebrow">{p.reason.replaceAll("_", " ")}</span>
              <h2>{p.text}</h2>
              <div className="eco-actions">
                <Link
                  className="eco-link-button"
                  href={`/app/record?prompt=${encodeURIComponent(p.text)}`}
                >
                  Record now
                </Link>
                <button disabled={skip.isPending} onClick={() => skip.mutate(p.id)}>
                  Skip
                </button>
              </div>
            </article>
          ))
      ) : (
        <Empty
          title="A pause between stories"
          description="After a recording is processed, a few thoughtful follow-ups will appear here. You can start a fresh story any time."
        >
          <Link className="eco-primary" href="/app/record">
            Record a story
          </Link>
        </Empty>
      )}
    </>
  );
}

export function Activity() {
  const events = useQuery({ queryKey: ["audit"], queryFn: () => request<Event[]>("/v1/audit") });
  return (
    <>
      <Heading
        eyebrow="A clear record"
        title="Your activity"
        description="Views of your content, permission changes, and exports. A little transparency goes a long way."
      />
      <ErrorState error={events.error} />
      {events.isPending ? (
        <p>Loading activity…</p>
      ) : events.data?.length ? (
        <div className="eco-list">
          {events.data.map((e) => (
            <article className="eco-card" key={e.id}>
              <strong>{e.action.replaceAll(".", " · ")}</strong>
              <p>
                {new Date(e.created_at).toLocaleString()} · {e.item_type.replaceAll("_", " ")}
              </p>
              {e.meta.reason && (
                <small>
                  {e.meta.reason.replaceAll("_", " ")} {e.meta.level && `· ${e.meta.level}`}
                </small>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Your archive is quiet"
          description="When you confirm a memory, change sharing, or someone reads your content, you’ll see it here."
        />
      )}
    </>
  );
}
