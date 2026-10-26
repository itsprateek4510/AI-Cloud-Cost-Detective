"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import type { Member } from "@/lib/domain";
import { useApp } from "./provider";
import { Chat } from "./chat";
import { Heading, Empty, Modal, ErrorState } from "./common";

export function Circles() {
  const { families, family: currentFamily, spaces, user, setSpace } = useApp();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [fid, setFid] = useState("");
  const family = fid || currentFamily?.id;
  const [memberSpace, setMemberSpace] = useState("");
  const selected = spaces.find((s) => s.id === memberSpace);
  const members = useQuery({
    queryKey: ["members", selected?.family_id],
    queryFn: () => request<Member[]>(`/v1/families/${selected?.family_id}/members`),
    enabled: !!selected,
  });
  const create = useMutation({
    mutationFn: (data: FormData) =>
      request("/v1/spaces", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), family_id: family }),
      }),
    onSuccess: () => {
      setOpen(false);
      void client.invalidateQueries({ queryKey: ["spaces"] });
    },
  });
  const add = useMutation({
    mutationFn: (id: string) =>
      request(`/v1/spaces/${memberSpace}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: id }),
      }),
    onSuccess: () => void client.invalidateQueries(),
  });
  if (active)
    return (
      <>
        <button onClick={() => setActive(false)}>← All groups</button>
        <div style={{ marginTop: 24 }}>
          <Chat kind="circle" />
        </div>
      </>
    );
  return (
    <>
      <Heading
        eyebrow="Shared interests, closer connections"
        title="Your groups"
        description="A smaller table within your family. Recipes, travel, cousins—each group has its own conversation and memory."
      >
        <button className="eco-primary" disabled={!families.length} onClick={() => setOpen(true)}>
          Create a group
        </button>
      </Heading>
      {!families.length ? (
        <Empty
          title="Start with a family"
          description="Groups belong to a family. Create one first."
        >
          <Link className="eco-link-button" href="/onboarding">
            Create family
          </Link>
        </Empty>
      ) : !spaces.some((s) => s.type === "circle") ? (
        <Empty
          title="Make room for a shared interest"
          description="A group starts with you. Add family members deliberately; other relatives won’t see its conversation."
        />
      ) : (
        <div className="eco-grid">
          {spaces
            .filter((s) => s.type === "circle")
            .map((s) => (
              <article className="eco-card" key={s.id}>
                <span className="eco-eyebrow">Group</span>
                <h2>{s.name}</h2>
                <div className="eco-actions">
                  <button
                    onClick={() => {
                      setSpace(s.id);
                      setActive(true);
                    }}
                  >
                    Open group
                  </button>
                  {s.owner_user_id === user.id && (
                    <button onClick={() => setMemberSpace(s.id)}>Add members</button>
                  )}
                </div>
              </article>
            ))}
        </div>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="A new group"
        description="Only you are added at first. You can invite family members after creating it."
      >
        <form
          className="eco-form"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(new FormData(e.currentTarget));
          }}
        >
          <label>
            Name
            <input name="name" placeholder="Cooking, Cousins, Travel…" maxLength={120} required />
          </label>
          <label>
            Family
            <select value={family} onChange={(e) => setFid(e.target.value)}>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <button className="eco-primary" disabled={create.isPending}>
            Create group
          </button>
          <ErrorState error={create.error} />
        </form>
      </Modal>
      <Modal
        open={!!memberSpace}
        onOpenChange={(v) => {
          if (!v) setMemberSpace("");
        }}
        title={`Add to ${selected?.name ?? "group"}`}
        description="New members can see this group’s conversation and published memories. Private items stay private."
      >
        {members.data
          ?.filter((m) => m.id !== user.id)
          .map((m) => (
            <div key={m.id} className="eco-settings-line">
              <span>{m.name}</span>
              <button disabled={add.isPending} onClick={() => add.mutate(m.id)}>
                Add member
              </button>
            </div>
          ))}
        <ErrorState error={add.error || members.error} />
        {add.isSuccess && <p role="status">Member added.</p>}
      </Modal>
    </>
  );
}
