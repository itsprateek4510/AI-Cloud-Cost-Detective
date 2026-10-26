"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Download,
  Eye,
  FileDown,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { API_URL, request } from "@/lib/api";
import type {
  BookChapter,
  BookChapterKind,
  BookSources,
  BookTemplate,
  HeritageBook,
  Member,
  Person,
} from "@/lib/domain";
import { useUnsavedChanges } from "../use-unsaved-changes";

const TEMPLATES: { value: BookTemplate; label: string }[] = [
  { value: "classic_heritage", label: "Classic Heritage" },
  { value: "modern_legacy", label: "Modern Legacy" },
  { value: "founder_biography", label: "Founder Biography" },
];

const KINDS: { value: BookChapterKind; label: string }[] = [
  { value: "introduction", label: "Family-history introduction" },
  { value: "chapter", label: "Story chapter" },
  { value: "timeline", label: "Timeline highlights" },
  { value: "photographs", label: "Photographs" },
  { value: "founder", label: "Founder story" },
  { value: "values", label: "Family values and lessons" },
];

export function BookStudio({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: ["book", id],
    queryFn: () => request<HeritageBook>(`/v1/books/${id}`),
  });
  return (
    <div className="legacy">
      <Link className="legacy-back" href="/app/legacy/books">
        ← Heritage Book Studio
      </Link>
      {detail.isPending ? (
        <p className="legacy-loading" aria-busy="true">
          Opening the book studio…
        </p>
      ) : detail.isError ? (
        <p className="legacy-error" role="alert">
          {detail.error.message}
        </p>
      ) : (
        <BookWorkspace book={detail.data} />
      )}
    </div>
  );
}

function BookWorkspace({ book }: { book: HeritageBook }) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState(book.chapters[0]?.id ?? "");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<BookChapterKind>("chapter");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const canLeaveEditor = () =>
    !dirty || window.confirm("Leave without saving your chapter changes?");
  const members = useQuery({
    queryKey: ["legacy-members", book.family_id],
    queryFn: () => request<Member[]>(`/v1/families/${book.family_id}/members`),
  });
  const people = useQuery({
    queryKey: ["legacy-persons", book.family_id],
    queryFn: () => request<Person[]>(`/v1/families/${book.family_id}/persons`),
  });
  const sources = useQuery({
    queryKey: ["book-sources", book.id],
    queryFn: () => request<BookSources>(`/v1/books/${book.id}/sources`),
  });
  const selected = book.chapters.find((chapter) => chapter.id === selectedId) ?? book.chapters[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["book", book.id] });
    void client.invalidateQueries({ queryKey: ["books", book.family_id] });
    void client.invalidateQueries({ queryKey: ["book-sources", book.id] });
  };
  const reorder = useMutation({
    mutationFn: (chapterIds: string[]) =>
      request(`/v1/books/${book.id}/chapters/order`, {
        method: "PUT",
        body: JSON.stringify({ chapter_ids: chapterIds }),
      }),
    onSuccess: refresh,
  });
  const create = useMutation({
    mutationFn: () =>
      request<BookChapter>(`/v1/books/${book.id}/chapters`, {
        method: "POST",
        body: JSON.stringify({ title: newTitle, kind: newKind }),
      }),
    onSuccess: (chapter) => {
      setSelectedId(chapter.id);
      setAdding(false);
      setNewTitle("");
      setNewKind("chapter");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (chapterId: string) =>
      request(`/v1/book-chapters/${chapterId}`, { method: "DELETE" }),
    onSuccess: (_, chapterId) => {
      if (selectedId === chapterId) setSelectedId("");
      refresh();
    },
  });
  const approveBook = useMutation({
    mutationFn: () => request<HeritageBook>(`/v1/books/${book.id}/approve`, { method: "POST" }),
    onSuccess: (value) => {
      setNotice("Book approved. A private PDF can now be generated.");
      refresh();
      return value;
    },
  });
  const reopenBook = useMutation({
    mutationFn: () => request<HeritageBook>(`/v1/books/${book.id}/reopen`, { method: "POST" }),
    onSuccess: refresh,
  });
  const exportBook = useMutation({
    mutationFn: () =>
      request<{ filename: string }>(`/v1/books/${book.id}/export`, { method: "POST" }),
    onSuccess: (value) => {
      setNotice(`Private PDF generated: ${value.filename}. Download it below.`);
      refresh();
    },
  });
  const revokeExport = useMutation({
    mutationFn: () => request(`/v1/books/${book.id}/export`, { method: "DELETE" }),
    onSuccess: () => {
      setNotice("The private PDF export was revoked and erased.");
      refresh();
    },
  });
  const download = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/v1/books/${book.id}/download`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "This private PDF is unavailable.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = book.export.filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const move = (chapter: BookChapter, direction: -1 | 1) => {
    const ids = book.chapters.map((item) => item.id);
    const index = ids.indexOf(chapter.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };
  const allApproved =
    book.chapters.length > 0 &&
    book.chapters.every((chapter) => chapter.status === "approved" && chapter.ready);
  const error =
    reorder.error ||
    create.error ||
    remove.error ||
    approveBook.error ||
    reopenBook.error ||
    exportBook.error ||
    revokeExport.error ||
    download.error ||
    members.error ||
    people.error;
  return (
    <>
      <header className="legacy-head book-head">
        <div>
          <span className="legacy-eyebrow">Private heritage edition</span>
          <h1>{book.title}</h1>
          <p className="legacy-sub">
            {book.subtitle || "A family story in progress."} · {book.template_label} ·{" "}
            {book.chapters.length} {book.chapters.length === 1 ? "chapter" : "chapters"}
          </p>
        </div>
        <div className="book-head-actions">
          <div className="book-view-toggle" role="group" aria-label="Book view">
            <button
              className={`legacy-button ${view === "edit" ? "legacy-button--primary" : ""}`}
              onClick={() => setView("edit")}
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              className={`legacy-button ${view === "preview" ? "legacy-button--primary" : ""}`}
              onClick={() => {
                if (canLeaveEditor()) setView("preview");
              }}
            >
              <Eye size={14} /> Preview
            </button>
          </div>
          <span
            className={`legacy-badge ${book.status === "approved" ? "legacy-badge--gold" : ""}`}
          >
            {book.status === "approved" ? "Approved" : "Draft"}
          </span>
          {book.status === "approved" ? (
            <button
              className="legacy-button"
              disabled={reopenBook.isPending}
              onClick={() => reopenBook.mutate()}
            >
              <RefreshCw size={14} /> Reopen book
            </button>
          ) : (
            <button
              className="legacy-button legacy-button--primary"
              disabled={dirty || !allApproved || approveBook.isPending}
              onClick={() => approveBook.mutate()}
            >
              <Check size={14} /> {approveBook.isPending ? "Approving…" : "Approve book"}
            </button>
          )}
          {book.can_export && (
            <button
              className="legacy-button legacy-button--gold"
              disabled={dirty || exportBook.isPending}
              onClick={() => exportBook.mutate()}
            >
              <FileDown size={14} /> {exportBook.isPending ? "Rendering…" : "Export private PDF"}
            </button>
          )}
          {book.export.ready && (
            <>
              <button
                className="legacy-button"
                disabled={dirty || download.isPending}
                onClick={() => download.mutate()}
              >
                <Download size={14} /> Download PDF
              </button>
              <button
                className="legacy-button"
                disabled={revokeExport.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Revoke and erase this private PDF? You can generate a fresh one later.",
                    )
                  )
                    revokeExport.mutate();
                }}
              >
                <X size={14} /> Revoke PDF
              </button>
            </>
          )}
        </div>
      </header>
      <p className="founder-notice">
        <ShieldCheck size={16} /> Only you can open this studio. Approval is per chapter and for the
        whole book. The PDF is stored privately and can be revoked; it is never published or sent to
        a printer. Revoking removes the server copy; it cannot erase PDFs already downloaded.
      </p>
      {notice && (
        <p className="founder-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="legacy-error" role="alert">
          {error.message}
        </p>
      )}
      {book.export.ready && (
        <p className="legacy-note">
          Private PDF generated{" "}
          {book.export.generated_at ? new Date(book.export.generated_at).toLocaleString() : ""}.
          {book.export.sha256 ? ` SHA-256 ${book.export.sha256.slice(0, 12)}…` : ""}
        </p>
      )}
      <div className="book-studio">
        <aside className="book-chapter-rail">
          <div className="book-rail-head">
            <h2>Chapters</h2>
            <button className="legacy-button" onClick={() => setAdding(!adding)}>
              <Plus size={14} /> Add
            </button>
          </div>
          {adding && (
            <form
              className="book-add-chapter"
              onSubmit={(event) => {
                event.preventDefault();
                if (newTitle.trim()) create.mutate();
              }}
            >
              <label>
                Chapter title
                <input
                  required
                  maxLength={160}
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                />
              </label>
              <label>
                Chapter type
                <select
                  value={newKind}
                  onChange={(event) => setNewKind(event.target.value as BookChapterKind)}
                >
                  {KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="founder-form-actions">
                <button className="legacy-button" type="button" onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button
                  className="legacy-button legacy-button--primary"
                  disabled={create.isPending || !newTitle.trim()}
                >
                  Add chapter
                </button>
              </div>
            </form>
          )}
          <ol className="book-chapter-list">
            {book.chapters.map((chapter, index) => (
              <li key={chapter.id}>
                <button
                  className={`book-chapter-item ${chapter.id === selected?.id ? "book-chapter-item--active" : ""}`}
                  onClick={() => {
                    if (chapter.id === selected?.id || canLeaveEditor()) {
                      setSelectedId(chapter.id);
                      setView("edit");
                    }
                  }}
                >
                  <span className="book-chapter-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="book-chapter-copy">
                    <strong>{chapter.title}</strong>
                    <small>{chapter.kind_label}</small>
                  </span>
                  <span
                    className={`legacy-badge ${chapter.status === "approved" ? "legacy-badge--gold" : ""}`}
                  >
                    {chapter.status === "approved" ? "Approved" : "Draft"}
                  </span>
                  {(!chapter.ready || chapter.source_errors.length > 0) && (
                    <span
                      className="book-warning-dot"
                      title={chapter.blocked_reason ?? "Review sources"}
                    />
                  )}
                </button>
                <div className="book-chapter-tools">
                  <button
                    className="book-icon-button"
                    aria-label={`Move ${chapter.title} up`}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(chapter, -1)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    className="book-icon-button"
                    aria-label={`Move ${chapter.title} down`}
                    disabled={index === book.chapters.length - 1 || reorder.isPending}
                    onClick={() => move(chapter, 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    className="book-icon-button"
                    aria-label={`Delete ${chapter.title}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete "${chapter.title}"? This cannot be undone.`))
                        remove.mutate(chapter.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </aside>
        <div className="book-main">
          {view === "preview" ? (
            <BookPreview book={book} />
          ) : (
            <>
              <BookSettings
                key={book.version}
                book={book}
                members={members.data ?? []}
                people={people.data ?? []}
                sources={sources.data}
                onSaved={refresh}
              />
              {selected ? (
                <ChapterEditor
                  key={`${selected.id}:${selected.version}`}
                  chapter={selected}
                  sources={sources.data}
                  onSaved={refresh}
                  onDirtyChange={setDirty}
                />
              ) : (
                <section className="legacy-empty">
                  <BookOpen size={24} />
                  <strong>No chapters yet</strong>
                  <p>Add an introduction or story chapter to begin.</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function BookSettings({
  book,
  members,
  people,
  sources,
  onSaved,
}: {
  book: HeritageBook;
  members: Member[];
  people: Person[];
  sources?: BookSources;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle ?? "");
  const [template, setTemplate] = useState<BookTemplate>(book.template);
  const [audience, setAudience] = useState(book.audience_user_ids);
  const [persons, setPersons] = useState(book.person_ids);
  const save = useMutation({
    mutationFn: () =>
      request(`/v1/books/${book.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          subtitle,
          template,
          audience_user_ids: audience,
          person_ids: persons,
        }),
      }),
    onSuccess: onSaved,
  });
  return (
    <details className="founder-form-card book-settings">
      <summary>
        <span>Book details and audience</span>
        <span className="legacy-badge">{book.template_label}</span>
      </summary>
      <p className="legacy-note">
        Audiences and featured members are private planning choices. Changing the audience resets
        chapter approvals so sources can be checked again.
      </p>
      <form
        className="founder-form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Book title
          <input
            maxLength={160}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Subtitle
          <input
            maxLength={200}
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
          />
        </label>
        <label>
          Design template
          <select
            value={template}
            onChange={(event) => setTemplate(event.target.value as BookTemplate)}
          >
            {TEMPLATES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="book-fieldset founder-form-wide">
          <legend>Intended audience</legend>
          <div className="book-check-grid">
            {members.map((member) => (
              <label key={member.id} className="book-check">
                <input
                  type="checkbox"
                  checked={audience.includes(member.id)}
                  onChange={(event) =>
                    setAudience(
                      event.target.checked
                        ? [...audience, member.id]
                        : audience.filter((item) => item !== member.id),
                    )
                  }
                />
                {member.name} · {member.role}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="book-fieldset founder-form-wide">
          <legend>Family members featured</legend>
          <div className="book-check-grid">
            {people.map((person) => (
              <label key={person.id} className="book-check">
                <input
                  type="checkbox"
                  checked={persons.includes(person.id)}
                  onChange={(event) =>
                    setPersons(
                      event.target.checked
                        ? [...persons, person.id]
                        : persons.filter((item) => item !== person.id),
                    )
                  }
                />
                {person.display_name}
              </label>
            ))}
          </div>
        </fieldset>
        {sources && (
          <p className="legacy-note">
            {sources.audience.length} intended readers currently authorized for source material.
          </p>
        )}
        <div className="founder-form-actions founder-form-wide">
          <button
            className="legacy-button legacy-button--primary"
            disabled={save.isPending || !title.trim()}
          >
            Save book details
          </button>
        </div>
      </form>
      {save.error && (
        <p className="legacy-error" role="alert">
          {save.error.message}
        </p>
      )}
    </details>
  );
}

function ChapterEditor({
  chapter,
  sources,
  onSaved,
  onDirtyChange,
}: {
  chapter: BookChapter;
  sources?: BookSources;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [title, setTitle] = useState(chapter.title);
  const [body, setBody] = useState(chapter.body ?? "");
  const [aiAssisted, setAiAssisted] = useState(chapter.ai_assisted);
  const [memoryIds, setMemoryIds] = useState(chapter.memory_ids);
  const [recordingIds, setRecordingIds] = useState(chapter.recording_ids);
  const [fileIds, setFileIds] = useState(chapter.vault_file_ids);
  const [eventIds, setEventIds] = useState(chapter.timeline_event_ids);
  const [founderIds, setFounderIds] = useState(chapter.founder_ids);
  const [interviewIds, setInterviewIds] = useState(chapter.interview_ids);
  const [draftNotes, setDraftNotes] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const writingDirty =
    title !== chapter.title || body !== (chapter.body ?? "") || aiAssisted !== chapter.ai_assisted;
  const sourcesDirty = [
    [memoryIds, chapter.memory_ids],
    [recordingIds, chapter.recording_ids],
    [fileIds, chapter.vault_file_ids],
    [eventIds, chapter.timeline_event_ids],
    [founderIds, chapter.founder_ids],
    [interviewIds, chapter.interview_ids],
  ].some(
    ([current, saved]) =>
      current.length !== saved.length || current.some((id) => !saved.includes(id)),
  );
  const dirty = writingDirty || sourcesDirty;
  useUnsavedChanges(dirty);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const selectedSources = {
    memory_ids: memoryIds,
    recording_ids: recordingIds,
    vault_file_ids: fileIds,
    timeline_event_ids: eventIds,
    founder_ids: founderIds,
    interview_ids: interviewIds,
  };
  const save = useMutation({
    mutationFn: async () => {
      await request(`/v1/book-chapters/${chapter.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, body, ai_assisted: aiAssisted }),
      });
      if (sourcesDirty)
        await request(`/v1/book-chapters/${chapter.id}/sources`, {
          method: "PUT",
          body: JSON.stringify(selectedSources),
        });
    },
    onSuccess: () => {
      setNotice("Chapter saved as a draft. Approve it when the writing is ready.");
      onSaved();
    },
  });
  const saveSources = useMutation({
    mutationFn: () =>
      request(`/v1/book-chapters/${chapter.id}/sources`, {
        method: "PUT",
        body: JSON.stringify(selectedSources),
      }),
    onSuccess: () => {
      setNotice("Sources saved. Chapter approval was reset.");
      onSaved();
    },
  });
  const draft = useMutation({
    mutationFn: () =>
      request<{ body: string; unverified: string[] }>(`/v1/book-chapters/${chapter.id}/draft`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (value) => {
      setBody(value.body);
      setAiAssisted(true);
      setDraftNotes(value.unverified);
      setNotice(
        "AI draft inserted into the editor. Review it and save; it is not approved or published.",
      );
    },
  });
  const approve = useMutation({
    mutationFn: () => request(`/v1/book-chapters/${chapter.id}/approve`, { method: "POST" }),
    onSuccess: () => {
      setNotice("Chapter approved.");
      onSaved();
    },
  });
  const reopen = useMutation({
    mutationFn: () => request(`/v1/book-chapters/${chapter.id}/reopen`, { method: "POST" }),
    onSuccess: () => {
      setNotice("Chapter reopened for editing.");
      onSaved();
    },
  });
  const error = save.error || saveSources.error || draft.error || approve.error || reopen.error;
  const toggle = (values: string[], value: string, setter: (next: string[]) => void) =>
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  return (
    <section className="founder-form-card book-editor">
      <div className="book-editor-head">
        <div>
          <span className="legacy-eyebrow">{chapter.kind_label}</span>
          <h2>Edit chapter</h2>
        </div>
        <span
          className={`legacy-badge ${chapter.status === "approved" ? "legacy-badge--gold" : ""}`}
        >
          {chapter.status === "approved" ? "Approved" : "Draft"}
        </span>
      </div>
      {chapter.source_errors.map((message) => (
        <p className="legacy-error" role="alert" key={message}>
          {message}
        </p>
      ))}
      {chapter.blocked_reason && (
        <p className="legacy-note">Before approval: {chapter.blocked_reason}</p>
      )}
      {dirty && (
        <p className="legacy-note" role="status">
          Unsaved changes. Save chapter to keep your writing and source selections before approval
          or AI drafting.
        </p>
      )}
      <form
        className="founder-form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="founder-form-wide">
          Chapter title
          <input
            aria-label="Chapter title"
            maxLength={160}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="book-body-label founder-form-wide">
          Chapter writing
          <textarea
            aria-label="Chapter writing"
            rows={12}
            maxLength={20000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <div className="founder-form-actions founder-form-wide">
          <button
            className="legacy-button legacy-button--primary"
            disabled={save.isPending || !title.trim()}
          >
            {save.isPending ? "Saving…" : "Save chapter"}
          </button>
          <button
            className="legacy-button"
            type="button"
            disabled={
              dirty || save.isPending || saveSources.isPending || draft.isPending || !sources
            }
            onClick={() => draft.mutate()}
          >
            <Sparkles size={14} /> {draft.isPending ? "Drafting…" : "Draft from sources"}
          </button>
          {chapter.status === "approved" ? (
            <button
              className="legacy-button"
              type="button"
              disabled={reopen.isPending}
              onClick={() => reopen.mutate()}
            >
              <RefreshCw size={14} /> Reopen chapter
            </button>
          ) : (
            <button
              className="legacy-button legacy-button--gold"
              type="button"
              disabled={
                dirty ||
                save.isPending ||
                saveSources.isPending ||
                approve.isPending ||
                !chapter.ready
              }
              onClick={() => approve.mutate()}
            >
              <Check size={14} /> Approve chapter
            </button>
          )}
        </div>
      </form>
      {aiAssisted && (
        <p className="legacy-note">
          <Sparkles size={13} /> This chapter includes AI-assisted writing. It remains editable and
          requires your approval.
        </p>
      )}
      {draftNotes.length > 0 && (
        <div className="book-unverified">
          <strong>Check these sentences against the sources:</strong>
          <ul>
            {draftNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
      {notice && (
        <p className="founder-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="legacy-error" role="alert">
          {error.message}
        </p>
      )}
      <section className="book-sources">
        <h3>Sources for this chapter</h3>
        <p className="legacy-note">
          Only confirmed stories, published founder chapters, shared photographs, and timeline
          highlights authorized for every intended reader appear here. Save sources before drafting.
        </p>
        {!sources ? (
          <p className="legacy-note">Opening permitted sources…</p>
        ) : (
          <>
            <SourceGroup
              title="Approved stories"
              items={sources.memories}
              selected={memoryIds}
              onToggle={(id) => toggle(memoryIds, id, setMemoryIds)}
              label={(item) => item.summary}
              meta={(item) => item.subject_name ?? item.kind_label}
            />
            <SourceGroup
              title="Recorded stories"
              items={sources.recordings}
              selected={recordingIds}
              onToggle={(id) => toggle(recordingIds, id, setRecordingIds)}
              label={(item) => item.title}
              meta={(item) => (item.transcript_authorized ? "Transcript available" : item.status)}
            />
            <SourceGroup
              title="Photographs"
              items={sources.photographs}
              selected={fileIds}
              onToggle={(id) => toggle(fileIds, id, setFileIds)}
              label={(item) => item.title}
              meta={(item) => item.occurred_on ?? item.description ?? ""}
            />
            <SourceGroup
              title="Timeline highlights"
              items={sources.timeline}
              selected={eventIds}
              onToggle={(id) => toggle(eventIds, id, setEventIds)}
              label={(item) => item.title}
              meta={(item) => item.occurred_on ?? item.date_note ?? ""}
            />
            <SourceGroup
              title="Published founder chapters"
              items={sources.founders}
              selected={founderIds}
              onToggle={(id) => toggle(founderIds, id, setFounderIds)}
              label={(item) => item.display_name}
              meta={(item) => item.published_chapters.map((chapter) => chapter.label).join(", ")}
            />
            {sources.private_interviews_allowed ? (
              <SourceGroup
                title="Private interviews"
                items={sources.interviews}
                selected={interviewIds}
                onToggle={(id) => toggle(interviewIds, id, setInterviewIds)}
                label={(item) => item.title}
                meta={(item) => item.subject_name ?? item.theme}
              />
            ) : (
              <p className="legacy-note">
                Interviews are private. Make the audience just yourself to include them.
              </p>
            )}
            <button
              className="legacy-button"
              type="button"
              disabled={writingDirty || save.isPending || saveSources.isPending}
              onClick={() => saveSources.mutate()}
            >
              {saveSources.isPending ? "Saving sources…" : "Save selected sources"}
            </button>
          </>
        )}
      </section>
    </section>
  );
}

type SourceItem = { id: string };
function SourceGroup<T extends SourceItem>({
  title,
  items,
  selected,
  onToggle,
  label,
  meta,
}: {
  title: string;
  items: T[];
  selected: string[];
  onToggle: (id: string) => void;
  label: (item: T) => string;
  meta: (item: T) => string | null;
}) {
  return (
    <details className="book-source-group">
      <summary>
        <span>{title}</span>
        <span className="legacy-badge">{selected.length} selected</span>
      </summary>
      {items.length ? (
        <div className="book-source-list">
          {items.map((item) => (
            <label key={item.id} className="book-source-item">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span>
                <strong>{label(item)}</strong>
                <small>{meta(item)}</small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="legacy-note">Nothing available for this audience yet.</p>
      )}
    </details>
  );
}

function BookPreview({ book }: { book: HeritageBook }) {
  return (
    <section className={`book-preview book-template-${book.template}`}>
      <div className="book-preview-cover">
        <span className="legacy-eyebrow">Private family edition</span>
        <h1>{book.title}</h1>
        {book.subtitle && <p>{book.subtitle}</p>}
        <div className="book-preview-rule" />
        <small>{book.template_label}</small>
        {book.persons.length > 0 && (
          <small>Featuring {book.persons.map((person) => person.name).join(", ")}</small>
        )}
      </div>
      <div className="book-preview-toc">
        <span className="legacy-eyebrow">Contents</span>
        <ol>
          {book.chapters.map((chapter) => (
            <li key={chapter.id}>{chapter.title}</li>
          ))}
        </ol>
      </div>
      {book.chapters.map((chapter) => (
        <article className="book-preview-chapter" key={chapter.id}>
          <span className="legacy-eyebrow">{chapter.kind_label}</span>
          <h2>{chapter.title}</h2>
          {chapter.body && <p className="book-preview-body">{chapter.body}</p>}
          {chapter.kind === "timeline" && (
            <div className="book-preview-events">
              {chapter.sources.timeline
                .filter((item) => item.available)
                .map((item) => (
                  <div key={item.id}>
                    <strong>
                      {item.occurred_on ?? item.date_note ?? "Undated"} · {item.label}
                    </strong>
                    {item.description && <p>{item.description}</p>}
                  </div>
                ))}
            </div>
          )}
          {chapter.kind === "photographs" && (
            <div className="book-preview-photos">
              {chapter.sources.photographs
                .filter((item) => item.available)
                .map((item) => (
                  <figure key={item.id}>
                    <BookPhoto fileId={item.id} alt={item.label} />
                    <figcaption>
                      {item.label}
                      {item.description ? ` — ${item.description}` : ""}
                    </figcaption>
                  </figure>
                ))}
            </div>
          )}
        </article>
      ))}
      <p className="book-preview-footer">
        <ShieldCheck size={13} /> Private family edition · not for public distribution
      </p>
    </section>
  );
}

function BookPhoto({ fileId, alt }: { fileId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void fetch(`${API_URL}/v1/vault/files/${fileId}/download`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((response) =>
        response.ok ? response.blob() : Promise.reject(new Error("Photograph unavailable")),
      )
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);
  return url ? (
    <Image src={url} alt={alt} width={640} height={480} unoptimized />
  ) : (
    <div className="book-photo-placeholder">Photograph preview</div>
  );
}
