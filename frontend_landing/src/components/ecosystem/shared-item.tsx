"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/lib/api";
import type { Message } from "@/lib/domain";
import { Heading, ErrorState } from "./common";
import { Citations } from "./chat";
import { VisibilityBadge } from "./shell";

export function SharedItem({ type, id }: { type: string; id: string }) {
  const content = useQuery({
    queryKey: ["shared-item", type, id],
    queryFn: async () => {
      if (type === "conversation") return request<Message[]>(`/v1/conversations/${id}/messages`);
      if (type === "message") return [await request<Message>(`/v1/messages/${id}`)];
      throw new Error("This shared item is not available.");
    },
    refetchInterval: 5000,
  });
  return (
    <>
      <Heading
        title={
          type === "conversation" ? "A conversation shared with you" : "A message shared with you"
        }
        description="Read-only access, chosen by the contributor. Access and citations are checked each time this view refreshes."
      />
      <VisibilityBadge personal={false} label="Shared with you" />
      <ErrorState error={content.error} />
      <div className="eco-chat" style={{ marginTop: 25 }}>
        {!content.error &&
          content.data?.map((m) => (
            <article key={m.id} className="eco-message">
              {m.body}
              <Citations citations={m.citations} />
            </article>
          ))}
      </div>
    </>
  );
}

export function SharedInbox() {
  const items = useQuery({
    queryKey: ["shared-items"],
    queryFn: () =>
      request<{ id: string; type: string; title: string; owner_name: string }[]>(
        "/v1/shared-items",
      ),
  });
  return (
    <>
      <Heading
        title="Shared with you"
        description="Stories and conversations that people have chosen to let you see."
      />
      <ErrorState error={items.error} />
      {items.isPending ? (
        <p>Opening shared items…</p>
      ) : items.data?.length ? (
        <div className="eco-list">
          {items.data.map((item) => (
            <Link
              className="eco-card"
              style={{ textDecoration: "none" }}
              key={`${item.type}-${item.id}`}
              href={
                item.type === "recording"
                  ? `/app/recordings/${item.id}`
                  : `/app/shared/${item.type}/${item.id}`
              }
            >
              <h2>{item.title}</h2>
              <p>
                Shared by {item.owner_name} · {item.type}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p>Nothing has been shared with you yet.</p>
      )}
    </>
  );
}
