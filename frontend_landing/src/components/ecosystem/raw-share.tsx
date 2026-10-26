"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import type { Grant, Member } from "@/lib/domain";
import { useApp } from "./provider";
import { Modal, ErrorState } from "./common";

export function RawShare({
  type,
  id,
}: {
  type: "recording" | "conversation" | "message";
  id: string;
}) {
  const { families, spaces, user } = useApp();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState("");
  const fid = family || families[0]?.id;
  const [target, setTarget] = useState("");
  const [level, setLevel] = useState(type === "recording" ? "summary" : "transcript");
  const path = `/v1/items/${type}/${id}`;
  const members = useQuery({
    queryKey: ["members", fid],
    queryFn: () => request<Member[]>(`/v1/families/${fid}/members`),
    enabled: open && !!fid,
  });
  const grants = useQuery({
    queryKey: ["raw-grants", type, id],
    queryFn: () => request<Grant[]>(`${path}/grants`),
    enabled: open,
  });
  const effective = useQuery({
    queryKey: ["raw-effective", type, id],
    queryFn: () => request<{ name: string; level: string }[]>(`${path}/effective-access`),
    enabled: open,
  });
  const change = useMutation({
    mutationFn: ({ method, url, body }: { method: string; url: string; body?: unknown }) =>
      request(url, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => void client.invalidateQueries(),
  });
  const familySpace = spaces.find((s) => s.type === "family" && s.family_id === fid);
  const audience =
    target === "family"
      ? members.data?.map((m) => m.name).join(", ")
      : members.data?.find((m) => m.id === target)?.name;
  return (
    <>
      <button onClick={() => setOpen(true)}>
        Share {type === "conversation" ? "thread" : type}
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`Share this ${type === "conversation" ? "thread" : type}`}
        description={
          type === "conversation"
            ? "People you grant access can read this thread, including future messages, until you revoke. Citations remain subject to their own access checks."
            : "Access is granted to this item only. Your other content stays private."
        }
      >
        <p className="eco-notice">
          Visible to:{" "}
          {effective.data?.map((v) => `${v.name} (${v.level})`).join(", ") || "Loading…"}
        </p>
        <label>
          Family
          <select
            value={fid}
            onChange={(e) => {
              setFamily(e.target.value);
              setTarget("");
            }}
          >
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Audience
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Only me · no new grant</option>
            {members.data
              ?.filter((m) => m.id !== user.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            {familySpace && <option value="family">Whole family</option>}
          </select>
        </label>
        {type === "recording" && (
          <label>
            Share level
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="summary">Summary · title and status only</option>
              <option value="transcript">Transcript · includes words</option>
              <option value="audio">Audio · whole recording</option>
            </select>
          </label>
        )}
        {target && (
          <p>
            Grant {level} access to <strong>{audience}</strong>.
          </p>
        )}
        <button
          className="eco-primary"
          disabled={!target || change.isPending}
          onClick={() =>
            change.mutate({
              method: "POST",
              url: `${path}/grants`,
              body: {
                grantee_type: target === "family" ? "space" : "user",
                family_id: fid,
                grantee_ref: target === "family" ? familySpace?.id : target,
                level,
              },
            })
          }
        >
          Confirm sharing
        </button>
        <h3 style={{ marginTop: 24 }}>Grant history</h3>
        {grants.data?.map((g) => (
          <div key={g.id} className="eco-settings-line">
            <span>
              {members.data?.find((m) => m.id === g.grantee_ref)?.name ?? "Shared audience"} ·{" "}
              {g.level} · {g.revoked_at ? "Revoked" : "Active"}
            </span>
            {!g.revoked_at && (
              <button
                disabled={change.isPending}
                onClick={() => change.mutate({ method: "DELETE", url: `${path}/grants/${g.id}` })}
              >
                Revoke
              </button>
            )}
          </div>
        ))}
        <ErrorState error={change.error || grants.error || members.error || effective.error} />
        {change.isSuccess && <p role="status">Access updated.</p>}
      </Modal>
    </>
  );
}
