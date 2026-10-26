"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  FileText,
  Flag,
  Link2,
  Mic,
  Pencil,
  Plus,
  Sprout,
  Store,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { request } from "@/lib/api";
import type { AvailableSources, TimelineEvent, TimelinePayload } from "@/lib/domain";
import { useApp } from "../provider";

const CATEGORY_ICONS: Record<string, ReactNode> = {
  birth: <Sprout size={14} />,
  milestone: <Flag size={14} />,
  achievement: <Trophy size={14} />,
  business: <Store size={14} />,
  event: <CalendarDays size={14} />,
  memory: <FileText size={14} />,
  photograph: <Camera size={14} />,
  recording: <Mic size={14} />,
  transition: <Users size={14} />,
};

const emptyEvent = {
  title: "",
  category: "birth",
  occurred_on: "",
  date_note: "",
  person_id: "",
  description: "",
};

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

function dateLabel(event: TimelineEvent) {
  if (!event.occurred_on) return event.date_note ?? "Date not recorded";
  const [year, month, day] = event.occurred_on.split("-").map(Number);
  const label = new Date(Date.UTC(year, (month || 1) - 1, day || 1)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return event.date_note ? `${label} · ${event.date_note}` : label;
}

function yearKey(event: TimelineEvent) {
  return event.occurred_on ? event.occurred_on.slice(0, 4) : "undated";
}

export function HeritageTimeline() {
  const { families, family, setFamily, user } = useApp();
  const [person, setPerson] = useState("");
  const [generation, setGeneration] = useState("");
  const [category, setCategory] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEvent);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyEvent);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const client = useQueryClient();

  const timeline = useQuery({
    queryKey: ["timeline", family?.id],
    queryFn: () => request<TimelinePayload>(`/v1/families/${family!.id}/timeline`),
    enabled: !!family,
    refetchOnWindowFocus: false,
  });
  const available = useQuery({
    queryKey: ["timeline-available", family?.id],
    queryFn: () => request<AvailableSources>(`/v1/families/${family!.id}/available-sources`),
    enabled: !!family && !!pickerFor,
  });

  const resetDetail = () => {
    setOpenId(null);
    setEditingId(null);
    setPickerFor(null);
    setConfirmRemove(null);
    setSearch("");
  };

  const refresh = () => {
    client.invalidateQueries({ queryKey: ["timeline", family?.id] });
    client.invalidateQueries({ queryKey: ["legacy-timeline", family?.id] });
  };

  const create = useMutation({
    mutationFn: () =>
      request<TimelineEvent>(`/v1/families/${family!.id}/timeline`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          occurred_on: form.occurred_on || null,
          date_note: form.date_note.trim() || null,
          person_id: form.person_id || null,
          description: form.description.trim() || null,
        }),
      }),
    onSuccess: (event) => {
      refresh();
      setAdding(false);
      setForm(emptyEvent);
      setError("");
      setNotice("Event added to the timeline.");
      setOpenId(event.id);
    },
    onError: (failure) => setError((failure as Error).message),
  });

  const update = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      request<TimelineEvent>(`/v1/timeline/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editForm.title.trim(),
          category: editForm.category,
          occurred_on: editForm.occurred_on || null,
          date_note: editForm.date_note.trim() || null,
          person_id: editForm.person_id || null,
          description: editForm.description.trim() || null,
        }),
      }),
    onSuccess: () => {
      refresh();
      setEditingId(null);
      setError("");
      setNotice("Event updated.");
    },
    onError: (failure) => setError((failure as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => request(`/v1/timeline/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      resetDetail();
      setError("");
      setNotice("Event removed from the timeline.");
    },
    onError: (failure) => setError((failure as Error).message),
  });

  const attach = useMutation({
    mutationFn: ({
      eventId,
      memory_id,
      recording_id,
    }: {
      eventId: string;
      memory_id?: string;
      recording_id?: string;
    }) =>
      request(`/v1/timeline/${eventId}/sources`, {
        method: "POST",
        body: JSON.stringify({ memory_id, recording_id }),
      }),
    onSuccess: () => {
      refresh();
      setError("");
      setNotice("Source attached. Access is re-checked each time this event is read.");
    },
    onError: (failure) => setError((failure as Error).message),
  });

  const detach = useMutation({
    mutationFn: ({ eventId, sourceId }: { eventId: string; sourceId: string }) =>
      request(`/v1/timeline/${eventId}/sources/${sourceId}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      setError("");
      setNotice("Source detached.");
    },
    onError: (failure) => setError((failure as Error).message),
  });

  const events = useMemo(() => timeline.data?.events ?? [], [timeline.data]);
  const persons = useMemo(() => timeline.data?.persons ?? [], [timeline.data]);
  const categories = useMemo(() => timeline.data?.categories ?? [], [timeline.data]);
  const canEdit = timeline.data?.can_edit ?? false;

  const generations = useMemo(() => {
    const values = new Set<number>();
    for (const item of persons) if (item.generation != null) values.add(item.generation);
    return [...values].sort((a, b) => a - b);
  }, [persons]);

  const filtered = useMemo(
    () =>
      events.filter(
        (event) =>
          (!person || event.person_id === person) &&
          (!generation || String(event.person_generation) === generation) &&
          (!category || event.category === category),
      ),
    [events, person, generation, category],
  );

  const groups = useMemo(() => {
    const out: { key: string; label: string; events: TimelineEvent[] }[] = [];
    for (const event of filtered) {
      const key = yearKey(event);
      const label = event.occurred_on ? key : "Date not recorded";
      const last = out[out.length - 1];
      if (last && last.key === key) last.events.push(event);
      else out.push({ key, label, events: [event] });
    }
    return out;
  }, [filtered]);

  const openEvent = events.find((event) => event.id === openId) ?? null;
  const attachedIds = useMemo(
    () => new Set((openEvent?.sources ?? []).map((source) => source.item_id).filter(Boolean)),
    [openEvent],
  );
  const pickerItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return {
      memories: (available.data?.memories ?? [])
        .filter((memory) => !attachedIds.has(memory.id))
        .filter(
          (memory) =>
            !term ||
            memory.summary.toLowerCase().includes(term) ||
            (memory.subject_name ?? "").toLowerCase().includes(term),
        )
        .slice(0, 12),
      recordings: (available.data?.recordings ?? [])
        .filter((recording) => !attachedIds.has(recording.id))
        .filter((recording) => !term || recording.title.toLowerCase().includes(term))
        .slice(0, 12),
    };
  }, [available.data, search, attachedIds]);

  const beginEdit = (event: TimelineEvent) => {
    setEditingId(event.id);
    setEditForm({
      title: event.title,
      category: event.category,
      occurred_on: event.occurred_on ?? "",
      date_note: event.date_note ?? "",
      person_id: event.person_id ?? "",
      description: event.description ?? "",
    });
    setPickerFor(null);
    setConfirmRemove(null);
  };

  if (!family) {
    return (
      <div className="legacy">
        <header className="legacy-head">
          <div>
            <span className="legacy-eyebrow">Smriti Legacy</span>
            <h1>Family Heritage Timeline</h1>
            <p className="legacy-sub">Walk through your family&apos;s history, event by event.</p>
          </div>
        </header>
        <section className="legacy-hero" style={{ marginTop: 26 }}>
          <span className="legacy-hero-mark">Begin</span>
          <h2>No family yet</h2>
          <p>Create a family before opening its heritage timeline.</p>
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
          <h1>Family Heritage Timeline</h1>
          <p className="legacy-sub">
            Your family&apos;s history in order — births, businesses, achievements, photographs,
            recorded stories, and generational transitions. Every event records who added it, and
            every attached source keeps its own access rules.
          </p>
        </div>
        {families.length > 1 && (
          <div className="legacy-family-picker">
            <label htmlFor="timeline-family">Family</label>
            <select
              id="timeline-family"
              aria-label="Family"
              value={family.id}
              onChange={(event) => {
                setFamily(event.target.value);
                resetDetail();
                setPerson("");
                setGeneration("");
                setCategory("");
                setAdding(false);
                setForm(emptyEvent);
                setError("");
                setNotice("");
              }}
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
          <CalendarDays size={18} />
        </span>
        <div>
          <strong>{family.name}</strong>
          <p>
            Generations are derived from confirmed parent relationships in the family tree. An
            attached memory or recording is only ever shown to people who may already read it.
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
            <Plus size={16} /> Add an event
          </button>
        )}
      </div>

      {adding && canEdit && (
        <section className="founder-form-card" aria-labelledby="timeline-form-title">
          <h2 id="timeline-form-title">A new timeline event</h2>
          <p className="legacy-note">
            Write down what happened, when it happened, and who it belongs to. You can attach the
            memories or recordings that support it after saving.
          </p>
          <p className="legacy-note">
            Event titles and descriptions are shared with the family. Do not copy private source
            material here. Photograph events can describe historical images; image upload is not
            available yet.
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
              Event title
              <input
                required
                maxLength={160}
                placeholder="The first shop opens"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {categories.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={form.occurred_on}
                onChange={(event) => setForm({ ...form, occurred_on: event.target.value })}
              />
            </label>
            <label>
              Date note
              <input
                maxLength={60}
                placeholder="circa, spring, after the monsoon…"
                value={form.date_note}
                onChange={(event) => setForm({ ...form, date_note: event.target.value })}
              />
            </label>
            <label>
              Family person
              <select
                value={form.person_id}
                onChange={(event) => setForm({ ...form, person_id: event.target.value })}
              >
                <option value="">Not linked to one person</option>
                {persons.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.generation != null ? ` · Generation ${item.generation}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="founder-form-wide">
              Description
              <textarea
                rows={4}
                maxLength={4000}
                placeholder="What happened, in the family's own words."
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
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
                disabled={create.isPending || !form.title.trim()}
              >
                {create.isPending ? "Adding…" : "Add to the timeline"}
              </button>
            </div>
          </form>
        </section>
      )}

      {error && !adding && (
        <p className="legacy-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="founder-notice" role="status">
          <Check size={15} /> {notice}
        </p>
      )}

      {timeline.isError && (
        <p className="legacy-error" role="alert">
          {(timeline.error as Error).message}
        </p>
      )}

      {timeline.isLoading ? (
        <p className="legacy-loading" aria-busy="true">
          Unrolling the family scroll…
        </p>
      ) : timeline.isError ? null : (
        <>
          <section className="timeline-filters" aria-label="Timeline filters">
            <div className="timeline-filter-row">
              <label className="timeline-select">
                Person
                <select
                  aria-label="Person"
                  value={person}
                  onChange={(event) => {
                    setPerson(event.target.value);
                    resetDetail();
                  }}
                >
                  <option value="">All people</option>
                  {persons.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="timeline-select">
                Generation
                <select
                  aria-label="Generation"
                  value={generation}
                  onChange={(event) => {
                    setGeneration(event.target.value);
                    resetDetail();
                  }}
                >
                  <option value="">All generations</option>
                  {generations.map((value) => (
                    <option key={value} value={String(value)}>
                      Generation {value}
                    </option>
                  ))}
                </select>
              </label>
              <p className="timeline-count" aria-live="polite">
                {filtered.length} of {events.length} event{events.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="timeline-chips" role="group" aria-label="Event category">
              <button
                type="button"
                className="timeline-chip"
                aria-pressed={category === ""}
                onClick={() => {
                  setCategory("");
                  resetDetail();
                }}
              >
                All
              </button>
              {categories.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="timeline-chip"
                  aria-pressed={category === item.key}
                  onClick={() => {
                    setCategory(category === item.key ? "" : item.key);
                    resetDetail();
                  }}
                >
                  {CATEGORY_ICONS[item.key]} {item.label}
                </button>
              ))}
            </div>
          </section>

          {events.length === 0 ? (
            <section className="founder-empty">
              <CalendarDays size={24} aria-hidden="true" />
              <h2>The timeline is waiting</h2>
              <p>
                No events have been added yet. Begin with a birth, a milestone, or the day a family
                business opened — then attach the memories and recordings that keep it grounded.
              </p>
              {canEdit && (
                <button
                  className="legacy-button legacy-button--primary"
                  onClick={() => setAdding(true)}
                >
                  <Plus size={16} /> Add the first event
                </button>
              )}
            </section>
          ) : filtered.length === 0 ? (
            <section className="founder-empty">
              <CalendarDays size={24} aria-hidden="true" />
              <h2>Nothing matches these filters</h2>
              <p>No event matches the person, generation, and category you have chosen.</p>
              <button
                className="legacy-button"
                onClick={() => {
                  setPerson("");
                  setGeneration("");
                  setCategory("");
                  resetDetail();
                }}
              >
                Clear filters
              </button>
            </section>
          ) : (
            <ol className="timeline-stream">
              {groups.map((group) => (
                <li className="timeline-group" key={group.key}>
                  <div className="timeline-year">
                    <span>{group.label}</span>
                  </div>
                  <ol className="timeline-items">
                    {group.events.map((event) => {
                      const open = openId === event.id;
                      return (
                        <li className="heritage-timeline-item" key={event.id}>
                          <article
                            className={`timeline-card${open ? " timeline-card--open" : ""}`}
                            onClick={() => {
                              if (!open) {
                                setOpenId(event.id);
                                setEditingId(null);
                                setPickerFor(null);
                                setConfirmRemove(null);
                              }
                            }}
                          >
                            <button
                              type="button"
                              className="timeline-card-toggle"
                              aria-expanded={open}
                              aria-controls={`timeline-event-${event.id}`}
                              onClick={(click) => {
                                click.stopPropagation();
                                if (open) {
                                  setOpenId(null);
                                  setEditingId(null);
                                  setPickerFor(null);
                                  setConfirmRemove(null);
                                } else {
                                  setOpenId(event.id);
                                }
                              }}
                            >
                              <span className="timeline-card-head">
                                <span className="timeline-cat">
                                  {CATEGORY_ICONS[event.category]} {event.category_label}
                                </span>
                                <span className="timeline-date">{dateLabel(event)}</span>
                              </span>
                              <span className="timeline-title">{event.title}</span>
                              <span className="timeline-meta">
                                {event.person_name && (
                                  <span>
                                    <UserRound size={12} /> {event.person_name}
                                    {event.person_generation != null
                                      ? ` · Generation ${event.person_generation}`
                                      : ""}
                                  </span>
                                )}
                                <span>
                                  <Link2 size={12} />{" "}
                                  {event.source_count === 0
                                    ? "No source attached"
                                    : `${event.source_count} source${event.source_count === 1 ? "" : "s"}`}
                                </span>
                                <span className="timeline-open-hint">
                                  {open ? "Close" : "Details"} <ChevronDown size={13} />
                                </span>
                              </span>
                            </button>

                            {open && (
                              <div
                                className="timeline-detail"
                                id={`timeline-event-${event.id}`}
                                onClick={(click) => click.stopPropagation()}
                              >
                                {editingId === event.id ? (
                                  <form
                                    className="founder-form timeline-edit-form"
                                    onSubmit={(submit) => {
                                      submit.preventDefault();
                                      setError("");
                                      update.mutate({ id: event.id });
                                    }}
                                  >
                                    <p className="legacy-note founder-form-wide">
                                      The family can read this title and description. Attached
                                      sources keep their own access restrictions.
                                    </p>
                                    <label>
                                      Event title
                                      <input
                                        required
                                        maxLength={160}
                                        value={editForm.title}
                                        onChange={(input) =>
                                          setEditForm({
                                            ...editForm,
                                            title: input.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Category
                                      <select
                                        value={editForm.category}
                                        onChange={(input) =>
                                          setEditForm({
                                            ...editForm,
                                            category: input.target.value,
                                          })
                                        }
                                      >
                                        {categories.map((item) => (
                                          <option key={item.key} value={item.key}>
                                            {item.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label>
                                      Date
                                      <input
                                        type="date"
                                        value={editForm.occurred_on}
                                        onChange={(input) =>
                                          setEditForm({
                                            ...editForm,
                                            occurred_on: input.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Date note
                                      <input
                                        maxLength={60}
                                        value={editForm.date_note}
                                        onChange={(input) =>
                                          setEditForm({
                                            ...editForm,
                                            date_note: input.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Family person
                                      <select
                                        value={editForm.person_id}
                                        onChange={(input) =>
                                          setEditForm({
                                            ...editForm,
                                            person_id: input.target.value,
                                          })
                                        }
                                      >
                                        <option value="">Not linked to one person</option>
                                        {persons.map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="founder-form-wide">
                                      Description
                                      <textarea
                                        rows={4}
                                        maxLength={4000}
                                        value={editForm.description}
                                        onChange={(input) =>
                                          setEditForm({
                                            ...editForm,
                                            description: input.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <div className="founder-form-actions founder-form-wide">
                                      <button
                                        type="button"
                                        className="legacy-button"
                                        onClick={() => setEditingId(null)}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="submit"
                                        className="legacy-button legacy-button--primary"
                                        disabled={update.isPending || !editForm.title.trim()}
                                      >
                                        {update.isPending ? "Saving…" : "Save changes"}
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <>
                                    {event.description ? (
                                      <div className="timeline-detail-text">
                                        {event.description
                                          .split(/\n{2,}/)
                                          .map((paragraph, index) => (
                                            <p key={index}>{paragraph}</p>
                                          ))}
                                      </div>
                                    ) : (
                                      <p className="legacy-note">
                                        No description has been added to this event.
                                      </p>
                                    )}
                                    <p className="timeline-provenance">
                                      Added by {event.created_by_name ?? "a family member"} on{" "}
                                      {shortDate(event.created_at)}
                                      {event.updated_by_name
                                        ? ` · Last edited by ${event.updated_by_name} on ${shortDate(event.updated_at)}`
                                        : ""}
                                    </p>

                                    <div className="founder-sources timeline-sources">
                                      <div className="founder-sources-head">
                                        <div>
                                          <h3>
                                            <Link2 size={15} /> Sources &amp; provenance
                                          </h3>
                                          <p>
                                            {event.source_count === 0
                                              ? "No material is attached yet."
                                              : `${event.source_count} attached. Access is re-checked each time this event is read.`}
                                          </p>
                                        </div>
                                        {event.can_edit && (
                                          <button
                                            className="legacy-button"
                                            onClick={() => {
                                              setPickerFor(
                                                pickerFor === event.id ? null : event.id,
                                              );
                                              setSearch("");
                                            }}
                                          >
                                            {pickerFor === event.id ? (
                                              <X size={14} />
                                            ) : (
                                              <Plus size={14} />
                                            )}
                                            {pickerFor === event.id ? "Close" : "Attach source"}
                                          </button>
                                        )}
                                      </div>

                                      {event.sources.length > 0 ? (
                                        <ul className="founder-source-list">
                                          {event.sources.map((source) => (
                                            <li className="founder-source" key={source.id}>
                                              <span
                                                className="founder-source-icon"
                                                aria-hidden="true"
                                              >
                                                {source.kind === "recording" ? (
                                                  <Mic size={15} />
                                                ) : (
                                                  <FileText size={15} />
                                                )}
                                              </span>
                                              <div>
                                                {source.available ? (
                                                  <>
                                                    <p className="founder-source-label">
                                                      {source.label}
                                                      <span className="legacy-badge legacy-badge--quiet">
                                                        {source.kind === "recording"
                                                          ? "recording"
                                                          : "memory"}{" "}
                                                        · {source.level}
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
                                                    A source is attached, but your current access
                                                    does not allow it to be shown.
                                                  </p>
                                                )}
                                              </div>
                                              {event.can_edit && (
                                                <button
                                                  className="founder-source-remove"
                                                  aria-label="Detach source"
                                                  title="Detach source"
                                                  onClick={() =>
                                                    detach.mutate({
                                                      eventId: event.id,
                                                      sourceId: source.id,
                                                    })
                                                  }
                                                >
                                                  <Trash2 size={15} />
                                                </button>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="legacy-note founder-source-empty">
                                          Nothing attached yet. Attach a confirmed memory or a
                                          recorded story so this event keeps its provenance.
                                        </p>
                                      )}

                                      {pickerFor === event.id && event.can_edit && (
                                        <div className="founder-picker">
                                          <label className="founder-picker-search">
                                            <span>Find a memory or recording</span>
                                            <input
                                              type="search"
                                              value={search}
                                              onChange={(input) => setSearch(input.target.value)}
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
                                                        {memory.subject_name
                                                          ? `${memory.subject_name} · `
                                                          : ""}
                                                        {memory.level} access
                                                      </small>
                                                    </span>
                                                    <button
                                                      className="legacy-button"
                                                      disabled={attach.isPending}
                                                      onClick={() =>
                                                        attach.mutate({
                                                          eventId: event.id,
                                                          memory_id: memory.id,
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
                                                        {recording.has_transcript
                                                          ? " · transcript available"
                                                          : ""}
                                                      </small>
                                                    </span>
                                                    <button
                                                      className="legacy-button"
                                                      disabled={attach.isPending}
                                                      onClick={() =>
                                                        attach.mutate({
                                                          eventId: event.id,
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
                                                Nothing matches yet. Only memories and recordings
                                                you can already read are listed here.
                                              </p>
                                            )}
                                          <p className="founder-picker-foot">
                                            <UserRound size={13} /> You are signed in as {user.name}
                                            . Attaching does not widen anyone&apos;s access.
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    {event.can_edit && (
                                      <div className="timeline-actions">
                                        <button
                                          className="legacy-button"
                                          onClick={() => beginEdit(event)}
                                        >
                                          <Pencil size={14} /> Edit event
                                        </button>
                                        <button
                                          className="legacy-button timeline-remove"
                                          onClick={() =>
                                            setConfirmRemove(
                                              confirmRemove === event.id ? null : event.id,
                                            )
                                          }
                                        >
                                          <Trash2 size={14} /> Remove event
                                        </button>
                                      </div>
                                    )}

                                    {confirmRemove === event.id && (
                                      <div
                                        className="founder-publish-confirm"
                                        role="dialog"
                                        aria-modal="false"
                                      >
                                        <div>
                                          <strong>Remove “{event.title}” from the timeline?</strong>
                                          <p>
                                            The event and its source links will be removed. The
                                            memories and recordings themselves stay in the archive,
                                            and this change is recorded in the family activity log.
                                          </p>
                                        </div>
                                        <div>
                                          <button
                                            className="legacy-button"
                                            onClick={() => setConfirmRemove(null)}
                                          >
                                            Keep event
                                          </button>
                                          <button
                                            className="legacy-button legacy-button--primary"
                                            disabled={remove.isPending}
                                            onClick={() => remove.mutate(event.id)}
                                          >
                                            {remove.isPending ? "Removing…" : "Confirm remove"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </article>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
