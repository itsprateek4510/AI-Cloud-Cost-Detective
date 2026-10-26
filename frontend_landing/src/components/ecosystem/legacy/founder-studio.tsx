"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Check,
  FileText,
  Link2,
  Mic,
  PenLine,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { request } from "@/lib/api";
import type {
  AvailableSources,
  Founder,
  FounderDetail,
  FounderSection,
  FounderSource,
  Person,
} from "@/lib/domain";
import { useApp } from "../provider";

function shortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function words(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function statusLabel(section: FounderSection) {
  if (section.withheld) return "In preparation";
  if (section.status === "published") return "Published";
  if (section.status === "draft") return "Draft";
  return "Not started";
}

function statusClass(section: FounderSection) {
  if (section.withheld) return "legacy-badge legacy-badge--quiet";
  if (section.status === "published") return "legacy-badge legacy-badge--published";
  if (section.status === "draft") return "legacy-badge legacy-badge--gold";
  return "legacy-badge legacy-badge--quiet";
}

function SectionBadge({ section }: { section: FounderSection }) {
  return <span className={statusClass(section)}>{statusLabel(section)}</span>;
}

export function FounderStudio({ founderId }: { founderId: string }) {
  const { user } = useApp();
  const client = useQueryClient();
  const detailKey = ["founder", founderId];
  const [active, setActive] = useState("early_life");
  const [narrative, setNarrative] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profile, setProfile] = useState({
    display_name: "",
    title: "",
    birth_year: "",
    summary: "",
    person_id: "",
  });

  const detail = useQuery({
    queryKey: detailKey,
    queryFn: () => request<FounderDetail>(`/v1/founders/${founderId}`),
  });
  const persons = useQuery({
    queryKey: ["legacy-persons", detail.data?.family_id],
    queryFn: () => request<Person[]>(`/v1/families/${detail.data!.family_id}/persons`),
    enabled: !!detail.data && editingProfile,
  });
  const available = useQuery({
    queryKey: ["founder-available-sources", founderId],
    queryFn: () => request<AvailableSources>(`/v1/founders/${founderId}/available-sources`),
    enabled: picker && !!detail.data?.can_edit,
  });

  const section = detail.data?.sections.find((item) => item.section === active);
  const canEdit = detail.data?.can_edit ?? false;

  useEffect(() => {
    setNarrative(section?.narrative ?? "");
  }, [active, section?.narrative]);

  useEffect(() => {
    setConfirmPublish(false);
    setPicker(false);
    setSearch("");
    setNotice("");
    setError("");
  }, [active]);

  function updateSection(next: FounderSection) {
    client.setQueryData<FounderDetail>(detailKey, (old) =>
      old
        ? {
            ...old,
            sections: old.sections.map((item) => (item.section === next.section ? next : item)),
          }
        : old,
    );
    client.invalidateQueries({ queryKey: ["founders"] });
  }

  function fail(failure: Error) {
    setError(failure.message);
    setNotice("");
  }

  const save = useMutation({
    mutationFn: (input: { section: string; narrative: string; version: number }) =>
      request<FounderSection>(`/v1/founders/${founderId}/chapters/${input.section}`, {
        method: "PUT",
        body: JSON.stringify({
          narrative: input.narrative,
          version: input.version,
        }),
      }),
    onSuccess: (chapter) => {
      updateSection(chapter);
      setNotice(
        chapter.status === "empty"
          ? "Chapter cleared. It is no longer visible to readers."
          : "Saved as a draft. It remains private until you publish it.",
      );
      setError("");
    },
    onError: (failure) => {
      fail(failure as Error);
      if ((failure as { status?: number }).status === 409) {
        client.invalidateQueries({ queryKey: detailKey });
      }
    },
  });

  const draft = useMutation({
    mutationFn: (target: string) =>
      request<FounderSection>(`/v1/founders/${founderId}/chapters/${target}/draft`, {
        method: "POST",
      }),
    onSuccess: (chapter) => {
      updateSection(chapter);
      setNotice(
        "AI draft created from your attached sources. It is still a draft — review every sentence before publishing.",
      );
      setError("");
    },
    onError: (failure) => fail(failure as Error),
  });

  const publish = useMutation({
    mutationFn: (target: string) =>
      request<FounderSection>(`/v1/founders/${founderId}/chapters/${target}/publish`, {
        method: "POST",
      }),
    onSuccess: (chapter) => {
      updateSection(chapter);
      setConfirmPublish(false);
      setNotice("Published to the family. Readers can now see this chapter.");
      setError("");
    },
    onError: (failure) => {
      setConfirmPublish(false);
      fail(failure as Error);
    },
  });

  const attach = useMutation({
    mutationFn: (input: { section: string; memory_id?: string; recording_id?: string }) =>
      request<FounderSource>(`/v1/founders/${founderId}/chapters/${input.section}/sources`, {
        method: "POST",
        body: JSON.stringify({
          memory_id: input.memory_id ?? null,
          recording_id: input.recording_id ?? null,
        }),
      }),
    onSuccess: (source) => {
      client.setQueryData<FounderDetail>(detailKey, (old) =>
        old
          ? {
              ...old,
              sections: old.sections.map((item) =>
                item.section === active
                  ? {
                      ...item,
                      sources: [...item.sources, source],
                      source_count: item.source_count + 1,
                    }
                  : item,
              ),
            }
          : old,
      );
      setNotice("Source attached. Its access rules continue to apply to every reader.");
      setError("");
    },
    onError: (failure) => fail(failure as Error),
  });

  const detach = useMutation({
    mutationFn: (sourceId: string) =>
      request<{ ok: boolean }>(`/v1/founders/${founderId}/chapters/${active}/sources/${sourceId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, sourceId) => {
      client.setQueryData<FounderDetail>(detailKey, (old) =>
        old
          ? {
              ...old,
              sections: old.sections.map((item) =>
                item.section === active
                  ? {
                      ...item,
                      sources: item.sources.filter((source) => source.id !== sourceId),
                      source_count: Math.max(0, item.source_count - 1),
                    }
                  : item,
              ),
            }
          : old,
      );
      setNotice("Source detached from this chapter.");
      setError("");
    },
    onError: (failure) => fail(failure as Error),
  });

  const editProfile = useMutation({
    mutationFn: () =>
      request<Founder>(`/v1/founders/${founderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: profile.display_name.trim(),
          title: profile.title.trim() || null,
          birth_year: profile.birth_year ? Number(profile.birth_year) : null,
          summary: profile.summary.trim() || null,
          person_id: profile.person_id || null,
        }),
      }),
    onSuccess: (founder) => {
      client.setQueryData<FounderDetail>(detailKey, (old) =>
        old ? { ...old, ...founder, sections: old.sections } : old,
      );
      client.invalidateQueries({ queryKey: ["founders"] });
      setEditingProfile(false);
      setNotice("Founder profile updated.");
      setError("");
    },
    onError: (failure) => fail(failure as Error),
  });

  function beginProfileEdit() {
    if (!detail.data) return;
    setProfile({
      display_name: detail.data.display_name,
      title: detail.data.title ?? "",
      birth_year: detail.data.birth_year ? String(detail.data.birth_year) : "",
      summary: detail.data.summary ?? "",
      person_id: detail.data.person_id ?? "",
    });
    setEditingProfile(true);
    setNotice("");
    setError("");
  }

  const pickerItems = useMemo(() => {
    const attached = new Set(
      (section?.sources ?? []).map((source) => `${source.kind}:${source.item_id}`),
    );
    const needle = search.trim().toLowerCase();
    const memories = (available.data?.memories ?? [])
      .filter((memory) => !attached.has(`memory:${memory.id}`))
      .filter((memory) => !needle || memory.summary.toLowerCase().includes(needle));
    const recordings = (available.data?.recordings ?? [])
      .filter((recording) => !attached.has(`recording:${recording.id}`))
      .filter((recording) => !needle || recording.title.toLowerCase().includes(needle));
    return { memories, recordings };
  }, [available.data, section?.sources, search]);

  if (detail.isLoading) {
    return (
      <div className="legacy">
        <p className="legacy-loading" aria-busy="true">
          Opening this founder&apos;s chapters…
        </p>
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="legacy">
        <Link className="legacy-back" href="/app/legacy/founders">
          ← All founders
        </Link>
        <p className="legacy-error" role="alert">
          {(detail.error as Error | null)?.message ?? "This founder could not be found."}
        </p>
      </div>
    );
  }

  const founder = detail.data;
  const publishedCount = founder.sections.filter((item) => item.status === "published").length;
  const draftCount = founder.sections.filter((item) => item.status === "draft").length;
  const dirty = narrative !== (section?.narrative ?? "");
  const current: FounderSection = section ?? {
    section: active,
    label: "Chapter",
    status: "empty",
    version: 0,
    ai_assisted: false,
    ai_notes: {},
    updated_at: null,
    published_at: null,
    published_by_name: null,
    source_count: 0,
    withheld: false,
    narrative: null,
    sources: [],
  };
  const canPublish =
    canEdit &&
    !!narrative.trim() &&
    !dirty &&
    (section?.source_count ?? 0) > 0 &&
    section?.status !== "published";
  const topWords = words(narrative);

  return (
    <div className="legacy">
      <header className="legacy-head founder-head">
        <div>
          <Link className="legacy-back" href="/app/legacy/founders">
            <ArrowLeft size={14} /> All founders
          </Link>
          <span className="legacy-eyebrow">Founder Legacy Studio</span>
          <h1>{founder.display_name}</h1>
          <p className="legacy-sub">
            {[founder.title, founder.birth_year ? `b. ${founder.birth_year}` : null]
              .filter(Boolean)
              .join(" · ") || "Family founder"}
            {founder.person_name ? ` · linked to ${founder.person_name}` : ""}
          </p>
          {founder.summary && <p className="founder-intro-text">{founder.summary}</p>}
        </div>
        <div className="founder-head-actions">
          <span className="legacy-badge legacy-badge--published">
            {publishedCount} of {founder.sections.length} published
          </span>
          {canEdit && <span className="legacy-badge">{draftCount} in draft</span>}
          {canEdit && (
            <button className="legacy-button" onClick={beginProfileEdit}>
              <PenLine size={15} /> Edit profile
            </button>
          )}
        </div>
      </header>

      {editingProfile && canEdit && (
        <section className="founder-form-card" aria-labelledby="profile-form-title">
          <h2 id="profile-form-title">Founder profile</h2>
          <p className="legacy-note">
            These details appear at the top of every chapter. They are not a story — the chapters
            hold the narrative and its sources.
          </p>
          <form
            className="founder-form"
            onSubmit={(event) => {
              event.preventDefault();
              editProfile.mutate();
            }}
          >
            <label>
              Founder&apos;s name
              <input
                required
                maxLength={120}
                value={profile.display_name}
                onChange={(event) => setProfile({ ...profile, display_name: event.target.value })}
              />
            </label>
            <label>
              Title or role
              <input
                maxLength={160}
                value={profile.title}
                onChange={(event) => setProfile({ ...profile, title: event.target.value })}
              />
            </label>
            <label>
              Birth year
              <input
                type="number"
                min={1200}
                max={2100}
                value={profile.birth_year}
                onChange={(event) => setProfile({ ...profile, birth_year: event.target.value })}
              />
            </label>
            <label>
              Linked family person
              <select
                value={profile.person_id}
                onChange={(event) => setProfile({ ...profile, person_id: event.target.value })}
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
              Short introduction
              <textarea
                rows={3}
                maxLength={2000}
                value={profile.summary}
                onChange={(event) => setProfile({ ...profile, summary: event.target.value })}
              />
            </label>
            <div className="founder-form-actions founder-form-wide">
              <button
                type="button"
                className="legacy-button"
                onClick={() => setEditingProfile(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="legacy-button legacy-button--primary"
                disabled={editProfile.isPending || !profile.display_name.trim()}
              >
                {editProfile.isPending ? "Saving…" : "Save founder profile"}
              </button>
            </div>
          </form>
        </section>
      )}

      {error && (
        <p className="legacy-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="founder-notice" role="status">
          <Check size={15} /> {notice}
        </p>
      )}

      <div className="founder-layout">
        <nav className="founder-rail" aria-label="Legacy chapters">
          <p className="founder-rail-title">Ten chapters</p>
          {founder.sections.map((item) => (
            <button
              key={item.section}
              type="button"
              className="founder-rail-item"
              aria-current={active === item.section ? "true" : undefined}
              onClick={() => setActive(item.section)}
            >
              <span>
                <strong>{item.label}</strong>
                <small>
                  {item.withheld
                    ? "In preparation"
                    : item.status === "published"
                      ? `Published${item.published_at ? ` · ${shortDate(item.published_at)}` : ""}`
                      : item.status === "draft"
                        ? `Draft · ${item.source_count} source${item.source_count === 1 ? "" : "s"}`
                        : "Not started"}
                </small>
              </span>
              <span
                className={`founder-rail-dot founder-rail-dot--${item.withheld ? "quiet" : item.status}`}
              />
            </button>
          ))}
          <p className="founder-rail-foot">
            <ShieldCheck size={14} /> Drafts stay with family writers. Published chapters open to
            the whole family.
          </p>
        </nav>

        <section className="founder-editor" aria-labelledby="chapter-title">
          <div className="founder-editor-head">
            <div>
              <span className="legacy-eyebrow">Chapter</span>
              <h2 id="chapter-title">{current.label}</h2>
            </div>
            <div className="founder-editor-badges">
              <SectionBadge section={current} />
              {current.ai_assisted && (
                <span className="legacy-badge legacy-badge--quiet">
                  <Sparkles size={11} /> AI-assisted
                </span>
              )}
            </div>
          </div>

          {current.withheld ? (
            <div className="founder-withheld">
              <FileText size={22} aria-hidden="true" />
              <h3>This chapter is being prepared</h3>
              <p>
                Drafts are visible only to family members who can edit the archive. Published
                chapters appear here for everyone in the family.
              </p>
            </div>
          ) : !canEdit ? (
            <div className="founder-reading">
              {current.narrative ? (
                current.narrative
                  .split(/\n{2,}/)
                  .map((paragraph, index) => <p key={index}>{paragraph}</p>)
              ) : (
                <p className="legacy-note">This chapter has not been written yet.</p>
              )}
              {current.published_at && (
                <p className="founder-published-meta">
                  Published by {current.published_by_name ?? "a family member"} on{" "}
                  {shortDate(current.published_at)}.
                  {current.ai_assisted
                    ? " Drafted with AI assistance from the sources below, then reviewed and approved by the family."
                    : ""}
                </p>
              )}
            </div>
          ) : (
            <>
              <label className="founder-editor-label" htmlFor="chapter-narrative">
                Chapter narrative
              </label>
              <textarea
                id="chapter-narrative"
                className="founder-textarea"
                value={narrative}
                onChange={(event) => {
                  setNarrative(event.target.value);
                  setNotice("");
                }}
                placeholder="Write this chapter in your own words, or attach sources and ask Smriti for a draft."
                maxLength={20000}
              />
              <div className="founder-meta-row">
                <span>{topWords} words</span>
                {dirty && <span className="founder-dirty">Unsaved changes</span>}
                {current.status === "published" && dirty && (
                  <span>Saving this edit will return the chapter to draft.</span>
                )}
              </div>

              {current.ai_assisted && current.status === "draft" && (
                <div className="founder-ai-note">
                  <Sparkles size={15} />
                  <p>
                    This narrative began as an AI-assisted draft. Only the attached sources were
                    supplied to the model. Read it against them before publishing.
                  </p>
                </div>
              )}

              {!!current.ai_notes?.unverified?.length && (
                <div className="founder-warning" role="note">
                  <strong>Review these sentences</strong>
                  <p>
                    The verification pass could not match them to the attached sources. Rewrite or
                    remove anything the sources do not support.
                  </p>
                  <ul>
                    {current.ai_notes.unverified.map((sentence, index) => (
                      <li key={index}>{sentence}</li>
                    ))}
                  </ul>
                </div>
              )}

              {current.status === "published" && !dirty && (
                <p className="founder-published-meta">
                  <Check size={14} /> Published by {current.published_by_name ?? "a family member"}{" "}
                  on {shortDate(current.published_at)}. Editing and saving returns it to draft for
                  fresh approval.
                </p>
              )}

              <div className="founder-actions">
                <button
                  className="legacy-button legacy-button--primary"
                  disabled={!dirty || save.isPending}
                  onClick={() =>
                    save.mutate({
                      section: active,
                      narrative,
                      version: current.version,
                    })
                  }
                >
                  {save.isPending ? "Saving…" : "Save draft"}
                </button>
                <button
                  className="legacy-button"
                  disabled={draft.isPending || dirty || current.source_count === 0}
                  title={
                    dirty
                      ? "Save or clear your edits before asking for a draft."
                      : current.source_count === 0
                        ? "Attach at least one source first."
                        : "Draft only from the attached sources."
                  }
                  onClick={() => draft.mutate(active)}
                >
                  <Sparkles size={15} /> {draft.isPending ? "Drafting…" : "AI draft"}
                </button>
                {current.status === "published" ? (
                  <span className="founder-published-chip">
                    <ShieldCheck size={14} /> Live for the family
                  </span>
                ) : (
                  <button
                    className="legacy-button legacy-button--gold"
                    disabled={!canPublish || publish.isPending}
                    title={
                      dirty
                        ? "Save your edits before publishing."
                        : current.source_count === 0
                          ? "Attach at least one source to publish."
                          : !narrative.trim()
                            ? "Write or draft the chapter first."
                            : "Publish to the family."
                    }
                    onClick={() => setConfirmPublish(true)}
                  >
                    <BookOpen size={15} /> Publish chapter
                  </button>
                )}
              </div>
              <p className="legacy-note founder-publish-note">
                AI never publishes. A family writer must review the narrative and approve it. Every
                chapter needs at least one source to be published.
              </p>

              {confirmPublish && (
                <div className="founder-publish-confirm" role="dialog" aria-modal="false">
                  <div>
                    <strong>Publish “{current.label}” to the family?</strong>
                    <p>
                      Every active family member will be able to read this chapter and the sources
                      they already have access to. You will be recorded as the approver.
                    </p>
                  </div>
                  <div>
                    <button className="legacy-button" onClick={() => setConfirmPublish(false)}>
                      Cancel
                    </button>
                    <button
                      className="legacy-button legacy-button--primary"
                      disabled={publish.isPending}
                      onClick={() => publish.mutate(active)}
                    >
                      {publish.isPending ? "Publishing…" : "Confirm publish"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="founder-sources">
            <div className="founder-sources-head">
              <div>
                <h3>
                  <Link2 size={16} /> Sources &amp; provenance
                </h3>
                <p>
                  {current.withheld
                    ? "Sources are hidden while this chapter is in preparation."
                    : `${current.source_count} attached. Access is re-checked each time this chapter is read.`}
                </p>
              </div>
              {canEdit && !current.withheld && (
                <button
                  className="legacy-button"
                  onClick={() => {
                    setPicker((open) => !open);
                    setSearch("");
                  }}
                >
                  {picker ? <X size={15} /> : <Plus size={15} />}
                  {picker ? "Close" : "Attach source"}
                </button>
              )}
            </div>

            {!current.withheld && current.sources.length > 0 ? (
              <ul className="founder-source-list">
                {current.sources.map((source) => (
                  <li className="founder-source" key={source.id}>
                    <span className="founder-source-icon" aria-hidden="true">
                      {source.kind === "recording" ? <Mic size={15} /> : <FileText size={15} />}
                    </span>
                    <div>
                      {source.available ? (
                        <>
                          <p className="founder-source-label">
                            {source.label}
                            <span className="legacy-badge legacy-badge--quiet">
                              {source.kind === "recording" ? "recording" : "memory"} ·{" "}
                              {source.level}
                            </span>
                          </p>
                          {source.quote && (
                            <blockquote className="founder-source-quote">
                              “{source.quote}”
                            </blockquote>
                          )}
                        </>
                      ) : (
                        <p className="founder-source-unavailable">
                          A source is attached, but your current access does not allow it to be
                          shown.
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <button
                        className="founder-source-remove"
                        aria-label="Detach source"
                        title="Detach source"
                        onClick={() => detach.mutate(source.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : current.withheld ? null : (
              <p className="legacy-note founder-source-empty">
                No sources yet. Attach a confirmed memory or a recorded story so this chapter keeps
                its provenance.
              </p>
            )}

            {picker && canEdit && (
              <div className="founder-picker">
                <label className="founder-picker-search">
                  <span>Find a memory or recording</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search what you can already read…"
                  />
                </label>
                {available.isLoading && (
                  <p className="legacy-note" aria-busy="true">
                    Looking through your permitted sources…
                  </p>
                )}
                {available.isError && (
                  <p className="legacy-error" role="alert">
                    {(available.error as Error).message}
                  </p>
                )}
                {!!pickerItems.memories.length && (
                  <div className="founder-picker-group">
                    <p>Memories</p>
                    <ul>
                      {pickerItems.memories.map((memory) => (
                        <li key={memory.id}>
                          <span>
                            <strong>{memory.summary}</strong>
                            <small>
                              {memory.subject_name ? `${memory.subject_name} · ` : ""}
                              {memory.level} access
                            </small>
                          </span>
                          <button
                            className="legacy-button"
                            disabled={attach.isPending}
                            onClick={() => attach.mutate({ section: active, memory_id: memory.id })}
                          >
                            Attach
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!pickerItems.recordings.length && (
                  <div className="founder-picker-group">
                    <p>Recordings</p>
                    <ul>
                      {pickerItems.recordings.map((recording) => (
                        <li key={recording.id}>
                          <span>
                            <strong>{recording.title}</strong>
                            <small>
                              {recording.status}
                              {recording.has_transcript ? " · transcript available" : ""}
                            </small>
                          </span>
                          <button
                            className="legacy-button"
                            disabled={attach.isPending}
                            onClick={() =>
                              attach.mutate({
                                section: active,
                                recording_id: recording.id,
                              })
                            }
                          >
                            Attach
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!available.isLoading &&
                  !available.isError &&
                  pickerItems.memories.length === 0 &&
                  pickerItems.recordings.length === 0 && (
                    <p className="legacy-note">
                      Nothing matches yet. Only memories and recordings you can already read are
                      listed here.
                    </p>
                  )}
                <p className="founder-picker-foot">
                  <UserRound size={13} /> You are signed in as {user.name}. Attaching does not widen
                  anyone&apos;s access.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
