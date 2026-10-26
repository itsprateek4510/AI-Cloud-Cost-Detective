"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { request } from "@/lib/api";
import type { Memory, Member, Grant, Space } from "@/lib/domain";
import { useApp } from "./provider";
import { Heading, Empty, ErrorState, Modal } from "./common";
import { VisibilityBadge } from "./shell";

const tabs = [
  ["suggested", "Suggested"],
  ["confirmed", "Confirmed"],
  ["shared_by_me", "Shared by me"],
  ["shared_with_me", "Shared with me"],
  ["forgotten", "Forgotten"],
];
const schema = z.object({
  summary: z.string().trim().min(1, "Write a short memory.").max(5000),
  evidence: z.string().trim().min(1, "Add the original words this memory is based on.").max(20000),
  kind: z.string(),
  sensitivity: z.string(),
});

export function MemoryCenter() {
  const { space } = useApp();
  const client = useQueryClient();
  const params = useSearchParams();
  const requestedTab = params.get("tab");
  const [tab, setTabState] = useState(
    tabs.some(([key]) => key === requestedTab) ? requestedTab! : "suggested",
  );
  const setTab = (next: string) => {
    setTabState(next);
    window.history.replaceState(null, "", `/app/memory?tab=${next}`);
  };
  const [create, setCreate] = useState(false);
  const allSpaces = tab.startsWith("shared_");
  const memories = useQuery({
    queryKey: ["memories", space?.id, tab],
    queryFn: () =>
      request<Memory[]>(
        `/v1/memories?tab=${tab}${!allSpaces && space ? `&space_id=${space.id}` : ""}`,
      ),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { summary: "", evidence: "", kind: "story", sensitivity: "normal" },
  });
  const save = useMutation({
    mutationFn: (body: z.infer<typeof schema>) =>
      request("/v1/memories", {
        method: "POST",
        body: JSON.stringify({ ...body, space_id: space?.id }),
      }),
    onSuccess: () => {
      setCreate(false);
      form.reset();
      setTab("suggested");
      void client.invalidateQueries({ queryKey: ["memories"] });
    },
  });
  return (
    <>
      <Heading
        eyebrow="Sourced. Reviewed. Remembered."
        title="Stories Smriti remembers"
        description="Small pieces of a life, kept with their original words. You decide what stays and who sees it."
      >
        <button className="eco-primary" onClick={() => setCreate(true)}>
          Add a memory
        </button>
      </Heading>
      <div className="eco-notice">
        New memories start as suggestions and stay private. Only confirmed memories can be used in
        archive answers.
      </div>
      <div className="eco-tabs" role="tablist" aria-label="Memory status">
        {tabs.map(([key, label]) => (
          <button role="tab" aria-selected={tab === key} key={key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <ErrorState error={memories.error} />
      {memories.isPending ? (
        <p aria-busy="true">Opening memories…</p>
      ) : memories.data?.length ? (
        memories.data.map((m) => <MemoryCard key={m.id} memory={m} />)
      ) : (
        !memories.error && (
          <Empty
            title={tab === "suggested" ? "A little space for a story" : "Nothing here yet"}
            description={
              tab === "suggested"
                ? "Add a memory in your own words, or record a conversation. Suggested memories will appear here for your review."
                : "Memories in this view will appear when you confirm or share them."
            }
          >
            <button onClick={() => setCreate(true)}>Add your first memory</button>
          </Empty>
        )
      )}
      <Modal
        open={create}
        onOpenChange={setCreate}
        title="Keep a memory"
        description="Save the original words as evidence. This starts private, awaiting your confirmation."
      >
        <form className="eco-form" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <label>
            The memory
            <textarea {...form.register("summary")} />
          </label>
          <ErrorState error={form.formState.errors.summary?.message} />
          <label>
            The original words or source quote
            <textarea {...form.register("evidence")} />
          </label>
          <ErrorState error={form.formState.errors.evidence?.message} />
          <label>
            Kind
            <select {...form.register("kind")}>
              {["story", "lesson", "fact", "belief", "advice"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Sensitivity
            <select {...form.register("sensitivity")}>
              {["normal", "sensitive", "never_share"].map((k) => (
                <option key={k} value={k}>
                  {k.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <ErrorState error={save.error} />
          <button className="eco-primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save for review · Only you"}
          </button>
        </form>
      </Modal>
    </>
  );
}

export function MemoryCard({ memory: m }: { memory: Memory }) {
  const { user } = useApp();
  const client = useQueryClient();
  const [share, setShare] = useState(false);
  const [edit, setEdit] = useState(false);
  const [summary, setSummary] = useState(m.summary);
  const action = useMutation({
    mutationFn: ({
      path = "",
      method = "POST",
      body,
    }: {
      path?: string;
      method?: string;
      body?: unknown;
    }) =>
      request(`/v1/memories/${m.id}${path}`, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => {
      setEdit(false);
      void client.invalidateQueries({ queryKey: ["memories"] });
    },
  });
  const owner = m.owner_user_id === user.id;
  const active = !["forgotten", "rejected", "orphaned"].includes(m.status);
  return (
    <article className="eco-card">
      <div className="eco-card-top">
        <div className="eco-meta">
          <span>{m.kind}</span>
          <span>·</span>
          <span>{m.status}</span>
          {m.pinned && <span>· Pinned</span>}
        </div>
        <VisibilityBadge
          personal={owner && m.access_reason === "owner"}
          label={owner ? "You own this" : `Shared · ${m.level}`}
        />
      </div>
      <h2 style={{ margin: "20px 0 14px" }}>{m.summary}</h2>
      <div className="eco-meta">
        Kept by {m.owner_name}
        {m.subject_name && ` · About ${m.subject_name}`} · {m.sensitivity?.replaceAll("_", " ")} · v
        {m.version}
      </div>
      {!!m.sources?.length && (
        <details>
          <summary>
            See {m.sources.length} source{m.sources.length > 1 ? "s" : ""}
          </summary>
          {m.sources.map((s) => (
            <blockquote key={s.id} className="eco-quote">
              “{s.quote}”
              <small style={{ display: "block" }}>
                {s.source_type}
                {s.start_ms != null && ` · ${Math.floor(s.start_ms / 1000)}s`}
              </small>
              {m.level === "audio" && s.source_type === "recording" && s.start_ms != null && (
                <Clip memoryId={m.id} sourceId={s.id} />
              )}
            </blockquote>
          ))}
        </details>
      )}
      {!owner && (
        <details>
          <summary className="eco-caption">Why can I see this?</summary>
          <p>
            {(
              {
                grant: "The owner shared this memory with you.",
                space_member: "This memory was published in a space you belong to.",
                relation_rule: "The owner shared it through a family relationship rule.",
              } as Record<string, string>
            )[m.access_reason] ?? "You have access to this memory."}{" "}
            Your access level is {m.level}.
          </p>
        </details>
      )}
      {owner && active && (
        <div className="eco-actions">
          {m.status === "suggested" && (
            <>
              <button
                disabled={action.isPending}
                onClick={() => action.mutate({ path: "/confirm" })}
              >
                Confirm memory
              </button>
              <button
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    method: "PATCH",
                    body: { version: m.version, status: "rejected" },
                  })
                }
              >
                Reject
              </button>
            </>
          )}
          <button
            onClick={() => {
              setSummary(m.summary);
              setEdit(true);
            }}
          >
            Edit
          </button>
          {m.status === "confirmed" && (
            <button onClick={() => setShare(true)}>Share / Publish</button>
          )}
          <button
            onClick={() =>
              action.mutate({ method: "PATCH", body: { version: m.version, pinned: !m.pinned } })
            }
          >
            {m.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            disabled={action.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Forget this memory? It will stop appearing in archive answers immediately.",
                )
              )
                action.mutate({ method: "DELETE" });
            }}
          >
            Forget
          </button>
        </div>
      )}
      <ErrorState error={action.error} />
      <Modal
        open={edit}
        onOpenChange={setEdit}
        title="Correct this memory"
        description="Your original source stays intact. This edit creates a new version."
      >
        <form
          className="eco-form"
          onSubmit={(e) => {
            e.preventDefault();
            action.mutate({
              method: "PATCH",
              body: { version: m.version, summary, reason: "Owner correction" },
            });
          }}
        >
          <label>
            Memory
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              maxLength={5000}
            />
          </label>
          <button className="eco-primary" disabled={action.isPending}>
            Save new version
          </button>
        </form>
      </Modal>
      <ShareSheet memory={m} open={share} close={() => setShare(false)} />
    </article>
  );
}

function Clip({ memoryId, sourceId }: { memoryId: string; sourceId: string }) {
  const [url, setUrl] = useState("");
  const load = useMutation({
    mutationFn: () =>
      request<{ url: string }>(`/v1/memories/${memoryId}/sources/${sourceId}/audio-url`),
    onSuccess: (data) => setUrl(data.url),
  });
  return (
    <div>
      <button onClick={() => load.mutate()} disabled={load.isPending}>
        {url ? "Refresh clip" : "Load cited clip"}
      </button>
      {url && <audio src={url} controls preload="none" onError={() => setUrl("")} />}
      <ErrorState error={load.error} />
    </div>
  );
}

function ShareSheet({ memory, open, close }: { memory: Memory; open: boolean; close: () => void }) {
  const { families, spaces, user } = useApp();
  const client = useQueryClient();
  const [familyId, setFamily] = useState("");
  const fid = familyId || families[0]?.id;
  const [audience, setAudience] = useState<"only" | "people" | "family">("only");
  const [selected, setSelected] = useState<string[]>([]);
  const [level, setLevel] = useState("summary");
  const [sensitive, setSensitive] = useState(false);
  const [previewId, setPreviewId] = useState("");
  const [hiddenChoice, setHidden] = useState<string[] | null>(null);
  const denials = useQuery({
    queryKey: ["denials", memory.id],
    queryFn: () => request<string[]>(`/v1/memories/${memory.id}/denials`),
    enabled: open,
  });
  const hidden = hiddenChoice ?? denials.data ?? [];
  const [release, setRelease] = useState("");
  const [expires, setExpires] = useState("");
  const [notice, setNotice] = useState("");
  const members = useQuery({
    queryKey: ["members", fid],
    queryFn: () => request<Member[]>(`/v1/families/${fid}/members`),
    enabled: open && !!fid,
  });
  const grants = useQuery({
    queryKey: ["grants", memory.id],
    queryFn: () => request<Grant[]>(`/v1/items/memory/${memory.id}/grants`),
    enabled: open,
  });
  const effective = useQuery({
    queryKey: ["effective", memory.id],
    queryFn: () =>
      request<{ user_id: string; name: string; level: string }[]>(
        `/v1/items/memory/${memory.id}/effective-access`,
      ),
    enabled: open,
  });
  const preview = useQuery({
    queryKey: ["preview", memory.id, previewId],
    queryFn: () =>
      request<{ visible: boolean; memory?: Memory }>(
        `/v1/access/preview?memory_id=${memory.id}&viewer_id=${previewId}`,
      ),
    enabled: open && !!previewId,
  });
  const mutation = useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body,
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => request(path, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => {
      setNotice("Access updated.");
      void client.invalidateQueries();
    },
  });
  const familySpace = spaces.find((s) => s.family_id === fid && s.type === "family");
  const membersForShare = members.data?.filter((m) => m.id !== user.id) ?? [];
  const names =
    audience === "family"
      ? membersForShare
          .filter((m) => !hidden.includes(m.id))
          .map((m) => m.name)
          .join(", ")
      : audience === "people"
        ? selected
            .map((id) => membersForShare.find((m) => m.id === id)?.name)
            .filter(Boolean)
            .join(", ")
        : "Only you";
  const share = useMutation({
    mutationFn: async () => {
      if (audience === "only") return;
      const common = {
        level,
        except_user_ids: hidden,
        family_id: fid,
        release_at: release ? new Date(release).toISOString() : null,
        expires_at: expires ? new Date(expires).toISOString() : null,
        confirm_sensitive: sensitive,
      };
      if (audience === "family") {
        if (!familySpace) throw new Error("Choose a family with a shared space first.");
        await request(`/v1/items/memory/${memory.id}/grants`, {
          method: "POST",
          body: JSON.stringify({
            ...common,
            grantee_type: "space",
            grantee_ref: familySpace.id,
          }),
        });
        return;
      }
      if (!selected.length) throw new Error("Choose at least one person.");
      await Promise.all(
        selected.map((id) =>
          request(`/v1/items/memory/${memory.id}/grants`, {
            method: "POST",
            body: JSON.stringify({ ...common, grantee_type: "user", grantee_ref: id }),
          }),
        ),
      );
    },
    onSuccess: () => {
      setNotice(audience === "only" ? "Only you can see this memory." : "Access updated.");
      void client.invalidateQueries();
    },
  });
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
      title="You choose who sees this"
      description="Sharing grants access to this memory in place. Publishing creates a separate shared copy; your original stays private."
    >
      <p className="eco-notice">
        Currently visible to:{" "}
        {effective.data?.map((m) => `${m.name} (${m.level})`).join(", ") || "Loading…"}
      </p>
      {memory.sensitivity === "never_share" ? (
        <p className="eco-error">Never-share is on. This memory cannot be granted or published.</p>
      ) : (
        <>
          {!!families.length && (
            <label>
              Family
              <select
                value={fid}
                onChange={(e) => {
                  setFamily(e.target.value);
                  setSelected([]);
                  setAudience("only");
                }}
              >
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <fieldset className="share-audience">
            <legend>Audience</legend>
            <label>
              <input
                type="radio"
                name="audience"
                checked={audience === "only"}
                onChange={() => setAudience("only")}
              />
              <span>
                <strong>Only me</strong>
                <small>No new access. Existing grants stay as they are.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="audience"
                checked={audience === "people"}
                onChange={() => setAudience("people")}
              />
              <span>
                <strong>Specific people</strong>
                <small>Choose one or more people below.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="audience"
                checked={audience === "family"}
                disabled={!familySpace}
                onChange={() => setAudience("family")}
              />
              <span>
                <strong>Whole family</strong>
                <small>
                  {familySpace
                    ? `Everyone in ${families.find((f) => f.id === fid)?.name ?? "this family"}`
                    : "Choose a family with a shared space first."}
                </small>
              </span>
            </label>
          </fieldset>
          {audience === "people" && (
            <fieldset className="share-people">
              <legend>Who can see it?</legend>
              {membersForShare.map((m) => (
                <label key={m.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(m.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, m.id]
                          : selected.filter((id) => id !== m.id),
                      )
                    }
                  />
                  {m.name}
                </label>
              ))}
            </fieldset>
          )}
          <details className="share-more">
            <summary>More options</summary>
            <label>
              Share level
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="summary">Summary · memory text only</option>
                <option value="transcript">Transcript · include original words</option>
                <option value="audio">Audio · include source clip access</option>
              </select>
            </label>
            <label>
              Release on a date (optional)
              <input
                type="datetime-local"
                value={release}
                onChange={(e) => setRelease(e.target.value)}
              />
            </label>
            <label>
              Expire access on a date (optional)
              <input
                type="datetime-local"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </label>
            <fieldset>
              <legend>Hide from · overrides whole-family grants</legend>
              {membersForShare.map((m) => (
                <label key={m.id}>
                  <input
                    type="checkbox"
                    checked={hidden.includes(m.id)}
                    onChange={(e) =>
                      setHidden(
                        e.target.checked ? [...hidden, m.id] : hidden.filter((id) => id !== m.id),
                      )
                    }
                  />
                  {m.name}
                </label>
              ))}
            </fieldset>
          </details>
          {memory.sensitivity === "sensitive" && (
            <label style={{ display: "flex", gap: 10 }}>
              <input
                type="checkbox"
                checked={sensitive}
                onChange={(e) => setSensitive(e.target.checked)}
              />
              I confirm sharing this sensitive memory with the people named below.
            </label>
          )}
          <p>
            People receiving access: <strong>{names || "No one yet"}</strong>. {level} level.
          </p>
          <div className="eco-actions">
            <button
              className="eco-primary"
              disabled={
                audience === "only" ||
                (audience === "people" && !selected.length) ||
                (audience === "family" && !familySpace) ||
                share.isPending ||
                (memory.sensitivity === "sensitive" && !sensitive)
              }
              onClick={() => share.mutate()}
            >
              Confirm sharing
            </button>
            <button
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  path: `/v1/memories/${memory.id}/denials`,
                  method: "PUT",
                  body: { user_ids: hidden },
                })
              }
            >
              Save Hide from
            </button>
          </div>
          <Publish
            memory={memory}
            spaces={spaces.filter((s) => s.type !== "personal")}
            sensitive={sensitive}
          />
        </>
      )}
      <h3 style={{ marginTop: 25 }}>View as a person</h3>
      <select
        aria-label="Preview viewer"
        value={previewId}
        onChange={(e) => setPreviewId(e.target.value)}
      >
        <option value="">Choose someone</option>
        {members.data?.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {preview.data && (
        <div className="eco-notice">
          {preview.data.visible ? (
            <>
              <strong>{preview.data.memory?.level} access</strong>
              <p>{preview.data.memory?.summary}</p>
              {preview.data.memory?.sources.map((s) => (
                <p key={s.id}>“{s.quote}”</p>
              ))}
            </>
          ) : (
            "No recorded view on this."
          )}
        </div>
      )}
      <h3 style={{ marginTop: 25 }}>Grant history</h3>
      {grants.data?.map((g) => (
        <div key={g.id} className="eco-settings-line">
          <span>
            {members.data?.find((m) => m.id === g.grantee_ref)?.name ??
              (g.grantee_type === "space" ? "Shared space" : g.grantee_type)}{" "}
            · {g.level} · {g.revoked_at ? "Revoked" : "Active / scheduled"}
          </span>
          {!g.revoked_at && (
            <button
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  path: `/v1/items/memory/${memory.id}/grants/${g.id}`,
                  method: "DELETE",
                })
              }
            >
              Revoke
            </button>
          )}
        </div>
      ))}
      <ErrorState
        error={share.error || mutation.error || grants.error || members.error || preview.error}
      />
      {notice && <p role="status">{notice}</p>}
    </Modal>
  );
}

function Publish({
  memory,
  spaces,
  sensitive,
}: {
  memory: Memory;
  spaces: Space[];
  sensitive: boolean;
}) {
  const client = useQueryClient();
  const [target, setTarget] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      request(`/v1/memories/${memory.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ space_id: target, confirm_sensitive: sensitive }),
      }),
    onSuccess: () => void client.invalidateQueries(),
  });
  return (
    <div style={{ marginTop: 24 }}>
      <label>
        Publish a Summary-level copy to
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Choose shared space</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!target || mutation.isPending}
        onClick={() => {
          if (
            window.confirm(
              `Publish a separate Summary-level memory to ${spaces.find((s) => s.id === target)?.name}? All space members can see it.`,
            )
          )
            mutation.mutate();
        }}
      >
        Publish copy
      </button>
      <ErrorState error={mutation.error} />
      {mutation.isSuccess && <p role="status">Published. Your original remains private.</p>}
    </div>
  );
}
