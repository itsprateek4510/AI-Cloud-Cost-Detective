"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { kinshipLabel } from "@/lib/kinship";
import type { Person, Member } from "@/lib/domain";
import { useApp } from "./provider";
import { Heading, Empty, ErrorState, Modal } from "./common";
import { copyFor } from "@/lib/i18n";

type Relation = {
  id: string;
  from_person_id: string;
  to_person_id: string;
  type: string;
  status: string;
  created_by: string;
  kinship_label?: string | null;
};

export function People() {
  const { families, family, setFamily, user } = useApp();
  const copy = copyFor(user.locale);
  const client = useQueryClient();
  const fid = family?.id;
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState("");
  const [added, setAdded] = useState<{ name: string; url: string } | null>(null);
  const [mode, setMode] = useState("list");
  const [relationChoice, setRelationChoice] = useState("Mother");
  const tree = useQuery({
    queryKey: ["tree", fid],
    queryFn: () =>
      request<{ persons: Person[]; relationships: Relation[] }>(`/v1/families/${fid}/tree`),
    enabled: !!fid,
  });
  const members = useQuery({
    queryKey: ["members", fid],
    queryFn: () => request<Member[]>(`/v1/families/${fid}/members`),
    enabled: !!fid,
  });
  const admin = ["owner", "admin"].includes(
    members.data?.find((m) => m.id === user.id)?.role ?? "",
  );
  const isOwner = members.data?.find((m) => m.id === user.id)?.role === "owner";
  const manage = useMutation({
    mutationFn: ({ id, role }: { id: string; role?: string }) =>
      request(`/v1/families/${fid}/members/${id}`, {
        method: role ? "PATCH" : "DELETE",
        body: role ? JSON.stringify({ role }) : undefined,
      }),
    onSuccess: () => void client.invalidateQueries(),
  });
  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      request(`/v1/families/${fid}/relationships/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["tree"] }),
  });
  const save = useMutation({
    mutationFn: async (data: FormData) => {
      const result = await request<{ person: { id: string; display_name: string } }>(
        `/v1/families/${fid}/people-with-relation`,
        {
          method: "POST",
          body: JSON.stringify({
            display_name: data.get("name"),
            relation: relationChoice,
            birth_year: data.get("year") ? Number(data.get("year")) : null,
            is_deceased: data.get("deceased") === "on",
            allow_duplicate: data.get("duplicate") === "on",
          }),
        },
      );
      let url = "";
      try {
        url = (
          await request<{ url: string }>(`/v1/families/${fid}/invites`, {
            method: "POST",
            body: JSON.stringify({ person_id: result.person.id }),
          })
        ).url;
      } catch {
        // Adding the person is still complete; Connect remains on their card.
      }
      return { name: result.person.display_name, url };
    },
    onSuccess: (result) => {
      setAdded(result);
      void client.invalidateQueries({ queryKey: ["tree"] });
    },
  });
  const sendInvite = useMutation({
    mutationFn: (id: string) =>
      request<{ url: string }>(`/v1/families/${fid}/invites`, {
        method: "POST",
        body: JSON.stringify({ person_id: id }),
      }),
    onSuccess: (data) => setInvite(data.url),
  });
  const name = (id: string) =>
    tree.data?.persons.find((p) => p.id === id)?.display_name ?? "Person";
  const groups = new Map<string, Person[]>();
  if (tree.data)
    for (const person of tree.data.persons) {
      const label = kinshipLabel(
        tree.data.persons.find((p) => p.linked_user_id === user.id),
        person,
        tree.data,
      );
      groups.set(label, [...(groups.get(label) ?? []), person]);
    }
  if (!families.length)
    return (
      <>
        <Heading title="Your people" />
        <Empty
          title="Begin with your family"
          description="Create a family space to add people, record relationships, and invite relatives."
        >
          <Link className="eco-primary" href="/onboarding">
            Create a family
          </Link>
        </Empty>
      </>
    );
  return (
    <>
      <Heading
        eyebrow="The people behind the stories"
        title={copy.family.peopleTitle}
        description={copy.family.peopleDescription}
      >
        <div className="eco-actions">
          <button className="eco-primary" onClick={() => setOpen(true)}>
            {copy.family.addAPerson}
          </button>
        </div>
      </Heading>
      <label>
        Family
        <select aria-label="Choose family" value={fid} onChange={(e) => setFamily(e.target.value)}>
          {families.map((f) => (
            <option value={f.id} key={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <div className="eco-tabs">
        <button onClick={() => setMode("list")} aria-pressed={mode === "list"}>
          My family
        </button>
        <button onClick={() => setMode("tree")} aria-pressed={mode === "tree"}>
          Relationships
        </button>
        <button onClick={() => setMode("graph")} aria-pressed={mode === "graph"}>
          Family tree
        </button>
      </div>
      <ErrorState error={tree.error || sendInvite.error || review.error} />
      {invite && (
        <div className="eco-notice" role="status">
          <strong>Invitation link · expires in 7 days</strong>
          <p style={{ overflowWrap: "anywhere" }}>{invite}</p>
          <div className="eco-actions">
            <button onClick={() => void navigator.clipboard.writeText(invite)}>Copy link</button>
            <a
              className="eco-link-button"
              href={`https://wa.me/?text=${encodeURIComponent(`Join our family on Smriti: ${invite}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              {copy.family.whatsapp}
            </a>
          </div>
        </div>
      )}
      {tree.isPending ? (
        <p>Loading people…</p>
      ) : mode === "list" ? (
        <div>
          {[...groups].map(([label, people]) => (
            <section key={label}>
              <h2>{label}</h2>
              <div className="eco-grid">
                {people.map((p) => (
                  <article className="eco-card eco-person-card" key={p.id}>
                    <span className="eco-person-avatar" aria-hidden="true">
                      {p.display_name
                        .split(/\s+/)
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className="eco-eyebrow">
                      {p.is_deceased
                        ? "Remembered with love"
                        : p.linked_user_id === user.id
                          ? "You"
                          : p.linked_user_id
                            ? "Family member"
                            : "Profile · no account"}
                    </span>
                    <h2>{p.display_name}</h2>
                    <p>
                      {tree.data &&
                        kinshipLabel(
                          tree.data.persons.find((v) => v.linked_user_id === user.id),
                          p,
                          tree.data,
                        )}
                    </p>
                    <p>
                      <span
                        aria-hidden="true"
                        style={{ color: p.linked_user_id ? "green" : "gray" }}
                      >
                        ●
                      </span>{" "}
                      {p.linked_user_id ? "On Smriti" : "Not joined"}
                    </p>
                    <Link href={`/app/record?person=${p.id}&family=${fid}`}>
                      Record their story
                    </Link>
                    {!p.linked_user_id && !p.is_deceased && (
                      <button
                        disabled={sendInvite.isPending}
                        onClick={() => sendInvite.mutate(p.id)}
                      >
                        Connect
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : mode === "graph" && tree.data ? (
        <FamilyTree people={tree.data.persons} relationships={tree.data.relationships} />
      ) : (
        <div className="eco-list">
          {tree.data?.relationships.length ? (
            tree.data.relationships.map((r) => (
              <div className="eco-card" key={r.id}>
                <strong>{name(r.from_person_id)}</strong> is {r.type.replaceAll("_", " ")}{" "}
                <strong>{name(r.to_person_id)}</strong>
                <p>Status: {r.status}</p>
                {(admin ||
                  tree.data?.persons.some(
                    (p) =>
                      p.linked_user_id === user.id &&
                      [r.from_person_id, r.to_person_id].includes(p.id),
                  )) && (
                  <div className="eco-actions">
                    {r.status !== "confirmed" && (admin || r.created_by !== user.id) && (
                      <button
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: r.id, status: "confirmed" })}
                      >
                        Confirm relationship
                      </button>
                    )}
                    {r.status !== "disputed" && (
                      <button
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: r.id, status: "disputed" })}
                      >
                        Flag as disputed
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <Empty
              title="Connect your family"
              description="Add the first relationship. Base relationships help derive family labels without guessing."
            />
          )}
        </div>
      )}
      <Modal
        bottomSheet
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setAdded(null);
        }}
        title="Add someone to your story"
        description="A profile doesn’t give them access. You can invite them separately."
      >
        {added ? (
          <div className="add-person-success" role="status">
            <strong>{added.name} is in your family.</strong>
            <p>
              {added.url
                ? "Send them a private connect link. It expires in 7 days and only adds them to this family."
                : "You can create a connect link later from their card."}
            </p>
            {added.url && (
              <a
                className="eco-primary add-person-whatsapp"
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Join our family on Smriti: ${added.url}`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                {copy.family.whatsapp}
              </a>
            )}
            <button
              type="button"
              className="eco-secondary"
              onClick={() => {
                setOpen(false);
                setAdded(null);
              }}
            >
              {copy.common.done}
            </button>
          </div>
        ) : (
        <form
          className="eco-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
        >
          <label>
            Name
            <input name="name" required maxLength={120} />
          </label>
          <fieldset>
            <legend>They are my:</legend>
            <div className="eco-actions">
              {[
                "Mother",
                "Father",
                "Spouse",
                "Child",
                "Sibling",
                "Grandparent",
                "Uncle/Aunt",
                "Cousin",
                "Other",
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={relationChoice === label}
                  onClick={() => setRelationChoice(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label style={{ display: "flex" }}>
            <input type="checkbox" name="duplicate" />
            Allow the same name as an existing person (different relative)
          </label>
          <button className="eco-primary" disabled={save.isPending}>
            Done
          </button>
          <ErrorState error={save.error} />
        </form>
        )}
      </Modal>
      {admin && (
        <section className="eco-card" style={{ marginTop: 24 }}>
          <h2>Family members & roles</h2>
          <p className="eco-caption">
            Admins manage membership, never another person’s private content. Viewer memberships are
            read-only.
          </p>
          {members.data?.map((member) => (
            <div className="eco-settings-line" key={member.id}>
              <span>
                {member.name}
                {member.id === user.id ? " · You" : ""}
              </span>
              {member.role === "owner" ? (
                <span className="eco-badge">Owner</span>
              ) : (
                <div className="eco-actions" style={{ marginTop: 0 }}>
                  <select
                    aria-label={`Role for ${member.name}`}
                    value={member.role}
                    style={{ width: "auto" }}
                    disabled={manage.isPending || (!isOwner && member.role === "admin")}
                    onChange={(e) => manage.mutate({ id: member.id, role: e.target.value })}
                  >
                    {(isOwner ? ["admin", "member", "viewer"] : ["member", "viewer"]).map(
                      (role) => (
                        <option key={role}>{role}</option>
                      ),
                    )}
                  </select>
                  <button
                    disabled={manage.isPending || (!isOwner && member.role === "admin")}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${member.name} from this family? Access ends immediately.`,
                        )
                      )
                        manage.mutate({ id: member.id });
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
          <ErrorState error={manage.error} />
        </section>
      )}
    </>
  );
}

function FamilyTree({ people, relationships }: { people: Person[]; relationships: Relation[] }) {
  const links = relationships.filter((r) => r.type === "parent_of" && r.status === "confirmed");
  const children = new Set(links.map((r) => r.to_person_id));
  const roots = people.filter((p) => !children.has(p.id));
  function branch(person: Person, seen: Set<string>, depth: number): React.ReactNode {
    if (seen.has(person.id) || depth > 5) return <li key={person.id}>↳ {person.display_name}</li>;
    const next = new Set([...seen, person.id]);
    const kids = links
      .filter((r) => r.from_person_id === person.id)
      .map((r) => people.find((p) => p.id === r.to_person_id))
      .filter((p): p is Person => !!p);
    return (
      <li key={person.id}>
        <div className="eco-tree-person">
          <strong>{person.display_name}</strong>
          {person.birth_year && (
            <small>
              {person.birth_year}
              {person.is_deceased ? " · In memory" : ""}
            </small>
          )}
        </div>
        {kids.length > 0 && <ul>{kids.map((p) => branch(p, next, depth + 1))}</ul>}
      </li>
    );
  }
  return (
    <section className="eco-card">
      <h2>Your family tree</h2>
      <p className="eco-caption">
        Confirmed parent relationships are shown as branches. Spouse, sibling, proposed, and
        disputed links remain visible in Relationships.
      </p>
      <div
        className="eco-tree"
        tabIndex={0}
        role="region"
        aria-label="Family tree, scroll for wider branches"
      >
        <ul>{(roots.length ? roots : people).map((p) => branch(p, new Set(), 0))}</ul>
      </div>
    </section>
  );
}
