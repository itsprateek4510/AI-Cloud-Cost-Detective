"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Landmark, Plus, Star, UserRound } from "lucide-react";
import { request } from "@/lib/api";
import type { Founder, Member, Person } from "@/lib/domain";
import { useApp } from "../provider";

const emptyForm = {
  display_name: "",
  title: "",
  birth_year: "",
  summary: "",
  person_id: "",
};

export function FoundersIndex() {
  const { families, spaces, family, setFamily, user } = useApp();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const router = useRouter();
  const client = useQueryClient();

  const founders = useQuery({
    queryKey: ["founders", family?.id],
    queryFn: () => request<Founder[]>(`/v1/families/${family!.id}/founders`),
    enabled: !!family,
    refetchOnWindowFocus: false,
  });
  const members = useQuery({
    queryKey: ["legacy-members", family?.id],
    queryFn: () => request<Member[]>(`/v1/families/${family!.id}/members`),
    enabled: !!family,
  });
  const persons = useQuery({
    queryKey: ["legacy-persons", family?.id],
    queryFn: () => request<Person[]>(`/v1/families/${family!.id}/persons`),
    enabled: !!family && adding,
  });

  const role = members.data?.find((member) => member.id === user.id)?.role;
  const canEdit = role ? role !== "viewer" : (founders.data?.[0]?.can_edit ?? false);

  const create = useMutation({
    mutationFn: () =>
      request<Founder>(`/v1/families/${family!.id}/founders`, {
        method: "POST",
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          title: form.title.trim() || null,
          birth_year: form.birth_year ? Number(form.birth_year) : null,
          summary: form.summary.trim() || null,
          person_id: form.person_id || null,
        }),
      }),
    onSuccess: (founder) => {
      client.invalidateQueries({ queryKey: ["founders", family?.id] });
      router.push(`/app/legacy/founders/${founder.id}`);
    },
    onError: (failure) => setError((failure as Error).message),
  });

  const familySpace = useMemo(
    () => spaces.find((item) => item.family_id === family?.id && item.type === "family"),
    [spaces, family],
  );

  if (!family) {
    return (
      <div className="legacy">
        <header className="legacy-head">
          <div>
            <span className="legacy-eyebrow">Smriti Legacy</span>
            <h1>Founder Legacy Studio</h1>
            <p className="legacy-sub">
              A founder&apos;s life is kept in chapters, each tied to the words it came from.
            </p>
          </div>
        </header>
        <section className="legacy-hero" style={{ marginTop: 26 }}>
          <span className="legacy-hero-mark">Begin</span>
          <h2>No family yet</h2>
          <p>Create a family before opening a founder&apos;s legacy.</p>
          <p style={{ marginTop: 18 }}>
            <Link
              href="/onboarding"
              style={{ color: "#cdb079", borderBottom: "1px solid rgba(205,176,121,0.6)" }}
            >
              Create a family →
            </Link>
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="legacy">
      <header className="legacy-head">
        <div>
          <Link className="legacy-back" href="/app/legacy">
            ← Heritage dashboard
          </Link>
          <span className="legacy-eyebrow">Smriti Legacy</span>
          <h1>Founder Legacy Studio</h1>
          <p className="legacy-sub">
            Preserve a founder&apos;s life, business journey, values, and counsel in ten chapters.
            Every chapter keeps its sources, and nothing is published without a family member&apos;s
            approval.
          </p>
        </div>
        {families.length > 1 && (
          <div className="legacy-family-picker">
            <label htmlFor="founder-family">Family</label>
            <select
              id="founder-family"
              aria-label="Family"
              value={family.id}
              onChange={(event) => setFamily(event.target.value)}
            >
              {families.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <div className="founder-intro">
        <span className="legacy-card-icon" aria-hidden="true">
          <Landmark size={18} />
        </span>
        <div>
          <strong>{family.name}</strong>
          <p>
            {familySpace
              ? "Founder chapters draw on this family's memories, recordings, and the founder's own words."
              : "Founder chapters are kept with the family; recordings and memories remain governed by their existing access."}
          </p>
        </div>
        {canEdit && (
          <button
            className="legacy-button legacy-button--primary"
            onClick={() => {
              setAdding((open) => !open);
              setError("");
            }}
          >
            <Plus size={16} /> Add a founder
          </button>
        )}
      </div>

      {adding && canEdit && (
        <section className="founder-form-card" aria-labelledby="founder-form-title">
          <h2 id="founder-form-title">A new founder</h2>
          <p className="legacy-note">
            Start with what you know. You can add chapters, sources, and refinements later.
          </p>
          <form
            className="founder-form"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              create.mutate();
            }}
          >
            <label>
              Founder&apos;s name
              <input
                required
                maxLength={120}
                value={form.display_name}
                onChange={(event) => setForm({ ...form, display_name: event.target.value })}
              />
            </label>
            <label>
              Title or role
              <input
                maxLength={160}
                placeholder="Founder, Mehra Group"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label>
              Birth year
              <input
                type="number"
                min={1200}
                max={2100}
                value={form.birth_year}
                onChange={(event) => setForm({ ...form, birth_year: event.target.value })}
              />
            </label>
            <label>
              Link to a family person (optional)
              <select
                value={form.person_id}
                onChange={(event) => setForm({ ...form, person_id: event.target.value })}
              >
                <option value="">Not linked</option>
                {(persons.data ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="founder-form-wide">
              A short introduction
              <textarea
                rows={3}
                maxLength={2000}
                placeholder="One or two sentences about the founder and the family they built."
                value={form.summary}
                onChange={(event) => setForm({ ...form, summary: event.target.value })}
              />
            </label>
            {error && (
              <p className="legacy-error founder-form-wide" role="alert">
                {error}
              </p>
            )}
            <div className="founder-form-actions founder-form-wide">
              <button type="button" className="legacy-button" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="legacy-button legacy-button--primary"
                disabled={create.isPending || !form.display_name.trim()}
              >
                {create.isPending ? "Creating…" : "Create founder profile"}
              </button>
            </div>
          </form>
        </section>
      )}

      {founders.isError && (
        <p className="legacy-error" role="alert">
          {(founders.error as Error).message}
        </p>
      )}

      {founders.isLoading ? (
        <p className="legacy-loading" aria-busy="true">
          Opening the founder archive…
        </p>
      ) : (founders.data ?? []).length === 0 ? (
        <section className="founder-empty">
          <Star size={24} aria-hidden="true" />
          <h2>No founder profiles yet</h2>
          <p>
            Begin with one founder. Their chapters stay private drafts until a family member reviews
            and publishes them.
          </p>
          {canEdit && (
            <button
              className="legacy-button legacy-button--primary"
              onClick={() => setAdding(true)}
            >
              <Plus size={16} /> Begin a founder&apos;s legacy
            </button>
          )}
        </section>
      ) : (
        <div className="founder-cards">
          {(founders.data ?? []).map((founder) => (
            <article className="founder-card" key={founder.id}>
              <div className="founder-card-head">
                <span className="legacy-avatar" aria-hidden="true">
                  {founder.display_name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("")}
                </span>
                <div>
                  <h3>{founder.display_name}</h3>
                  <p>
                    {[founder.title, founder.birth_year ? `b. ${founder.birth_year}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Family founder"}
                  </p>
                </div>
              </div>
              {founder.summary && <p className="founder-card-summary">{founder.summary}</p>}
              <div className="founder-card-meta">
                <span className="legacy-badge legacy-badge--navy">
                  {founder.published_count} published
                </span>
                {founder.can_edit && (
                  <span className="legacy-badge">{founder.draft_count} in draft</span>
                )}
                {founder.person_name && (
                  <span className="legacy-badge">
                    <UserRound size={11} /> {founder.person_name}
                  </span>
                )}
              </div>
              <Link className="founder-card-link" href={`/app/legacy/founders/${founder.id}`}>
                <BookOpen size={16} /> Open the studio <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
