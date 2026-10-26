"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Folder, LockKeyhole, Plus, ShieldCheck, Upload } from "lucide-react";
import { API_URL, request } from "@/lib/api";
import type {
  Person,
  Recording,
  VaultCollection,
  VaultConsent,
  VaultFile,
  VaultPayload,
} from "@/lib/domain";
import { useApp } from "../provider";

const labels: Record<string, string> = {
  photo: "Photo",
  letter: "Letter",
  document: "Document",
  family_history: "Family history",
  business_history: "Business history",
  milestone: "Milestone archive",
  audio: "Recorded audio",
};

export function FamilyVault() {
  const { families, family, setFamily } = useApp();
  return (
    <div className="legacy">
      <header className="legacy-head">
        <div>
          <Link className="legacy-back" href="/app/legacy">
            ← Heritage dashboard
          </Link>
          <span className="legacy-eyebrow">Smriti Legacy</span>
          <h1>Private Family Vault</h1>
          <p className="legacy-sub">
            A considered home for photographs, letters, family records, and the original voices
            behind them. Private by default; shared only by choice.
          </p>
        </div>
        {families.length > 1 && (
          <label className="legacy-family-picker">
            Family
            <select
              aria-label="Family"
              value={family?.id}
              onChange={(e) => setFamily(e.target.value)}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {family ? (
        <VaultBrowser key={family.id} familyId={family.id} />
      ) : (
        <section className="founder-empty">
          <h2>No family yet</h2>
          <p>Create a family to begin its private vault.</p>
          <Link href="/onboarding">Create a family →</Link>
        </section>
      )}
    </div>
  );
}

function VaultBrowser({ familyId }: { familyId: string }) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [person, setPerson] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingCollection, setEditingCollection] = useState(false);
  const query = new URLSearchParams({ q: search, category, person_id: person });
  const vault = useQuery({
    queryKey: ["vault", familyId, search, category, person],
    queryFn: () => request<VaultPayload>(`/v1/families/${familyId}/vault?${query}`),
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
  const people = useQuery({
    queryKey: ["legacy-persons", familyId],
    queryFn: () => request<Person[]>(`/v1/families/${familyId}/persons`),
  });
  const consents = useQuery({
    queryKey: ["vault-consents"],
    queryFn: () => request<VaultConsent[]>("/v1/vault/consents"),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["vault", familyId] });
    void client.invalidateQueries({ queryKey: ["vault-consents"] });
    void client.invalidateQueries({ queryKey: ["legacy-vault", familyId] });
  };
  const collections = vault.data?.collections ?? [];
  const selected = collections.find((c) => c.id === selectedId);
  const files = (vault.data?.files ?? []).filter(
    (f) => !selected || f.collection_id === selected.id,
  );
  const folders = collections.filter((c) => c.parent_id === (selected?.id ?? null));
  const create = useMutation({
    mutationFn: () =>
      request<VaultCollection>(`/v1/families/${familyId}/vault/collections`, {
        method: "POST",
        body: JSON.stringify({ name, description, parent_id: selected?.id ?? null }),
      }),
    onSuccess: (collection) => {
      refresh();
      setSelectedId(collection.id);
      setCreating(false);
      setName("");
      setDescription("");
    },
  });
  const sharing = useMutation({
    mutationFn: (visibility: "private" | "family") =>
      request(`/v1/vault/collections/${selected!.id}/sharing`, {
        method: "POST",
        body: JSON.stringify({ visibility, confirmed: true }),
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => request(`/v1/vault/collections/${selected!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedId(selected?.parent_id ?? "");
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => request(`/v1/vault/files/${id}/revoke`, { method: "POST" }),
    onSuccess: refresh,
  });
  const error =
    vault.error ||
    people.error ||
    create.error ||
    sharing.error ||
    remove.error ||
    revoke.error ||
    consents.error;
  if (vault.isPending)
    return (
      <p className="legacy-loading" aria-busy="true">
        Opening permitted collections…
      </p>
    );
  return (
    <>
      <p className="founder-notice">
        <ShieldCheck size={16} /> Collection sharing includes nested folders, not new recording
        permissions. Search matches permitted titles, descriptions, names, and filenames only — no
        document content or AI retrieval.
      </p>
      {vault.data?.capabilities.development_storage && (
        <p className="vault-warning" role="note">
          <strong>Development storage only.</strong> Local disk is not a production vault. Files may
          be unscanned in development. Production requires verified private S3 storage, encryption,
          and malware scanning.
        </p>
      )}
      {vault.data?.capabilities.storage_error && (
        <p className="legacy-error" role="alert">
          {vault.data.capabilities.storage_error}
        </p>
      )}
      {error && (
        <p className="legacy-error" role="alert">
          {error.message}
        </p>
      )}
      {vault.isError ? null : (
        <>
          <section className="vault-controls" aria-label="Vault navigation">
            <button
              className="legacy-button"
              onClick={() => {
                setSelectedId("");
                setCreating(false);
              }}
            >
              All permitted files
            </button>
            {selected && (
              <button
                className="legacy-button"
                onClick={() => setSelectedId(selected.parent_id ?? "")}
              >
                ↑ Parent folder
              </button>
            )}
            {(!selected || selected.can_manage) && (
              <button
                className="legacy-button legacy-button--primary"
                onClick={() => {
                  setCreating(!creating);
                  setEditingCollection(false);
                }}
              >
                <Plus size={15} /> {selected ? "New folder" : "New private collection"}
              </button>
            )}
          </section>
          {creating && (
            <section className="founder-form-card">
              <h2>{selected ? "New folder" : "New private collection"}</h2>
              <p className="legacy-note">
                {selected
                  ? "This folder inherits the top-level collection's permissions."
                  : "Only you can open a new collection until you deliberately share it with the family."}
              </p>
              <form
                className="founder-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate();
                }}
              >
                <label>
                  Collection or folder name
                  <input
                    required
                    maxLength={160}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows={2}
                    maxLength={4000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <div className="founder-form-actions founder-form-wide">
                  <button
                    className="legacy-button"
                    type="button"
                    onClick={() => setCreating(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="legacy-button legacy-button--primary"
                    disabled={create.isPending || !name.trim()}
                  >
                    Create collection or folder
                  </button>
                </div>
              </form>
            </section>
          )}
          {selected && (
            <section className="founder-form-card">
              <span className="legacy-eyebrow">
                {selected.parent_id ? "Folder" : "Collection"} ·{" "}
                {selected.visibility === "private"
                  ? "Private · only the owner"
                  : "Shared with active family members"}
              </span>
              <h2>{selected.name}</h2>
              <p className="legacy-note">{selected.description}</p>
              {selected.parent_id && (
                <p className="legacy-note">
                  Sharing is inherited.{" "}
                  <button
                    className="vault-text-button"
                    onClick={() => setSelectedId(selected.root_id)}
                  >
                    Open the top-level collection
                  </button>{" "}
                  to change it.
                </p>
              )}
              {selected.can_manage && (
                <div className="founder-actions">
                  {!selected.parent_id && (
                    <button
                      className="legacy-button"
                      disabled={sharing.isPending}
                      onClick={() => {
                        const visibility = selected.visibility === "private" ? "family" : "private";
                        if (
                          window.confirm(
                            visibility === "family"
                              ? "Share all files and nested folders in this collection with active family members? Recording access will not change."
                              : "Make this collection and all nested folders private? Previously downloaded originals cannot be recalled.",
                          )
                        )
                          sharing.mutate(visibility);
                      }}
                    >
                      {selected.visibility === "private"
                        ? "Share collection with family"
                        : "Revoke family access"}
                    </button>
                  )}
                  <button
                    className="legacy-button"
                    onClick={() => setEditingCollection(!editingCollection)}
                  >
                    Edit collection details
                  </button>
                  <button
                    className="legacy-button"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Delete this collection or folder and ALL its nested files? Original linked recordings are not deleted. Stored files will be erased; failed erasures are retried.",
                        )
                      )
                        remove.mutate();
                    }}
                  >
                    Delete collection or folder
                  </button>
                </div>
              )}
              {editingCollection && selected.can_manage && (
                <CollectionEditor
                  key={selected.id}
                  collection={selected}
                  done={() => {
                    setEditingCollection(false);
                    refresh();
                  }}
                />
              )}
            </section>
          )}
          {!!folders.length && (
            <nav className="vault-folders" aria-label="Collections and folders">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  className="vault-folder"
                  onClick={() => {
                    setSelectedId(folder.id);
                    setCreating(false);
                    setEditingCollection(false);
                  }}
                >
                  <Folder size={20} />
                  <span>
                    <strong>{folder.name}</strong>
                    <small>{folder.visibility === "private" ? "Private" : "Family shared"}</small>
                  </span>
                </button>
              ))}
            </nav>
          )}
          <section className="timeline-filters" aria-label="Search permitted files">
            <div className="vault-search-row">
              <label className="timeline-select vault-search">
                Search metadata
                <input
                  aria-label="Search vault metadata"
                  type="search"
                  maxLength={200}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Title, description, filename, or person…"
                />
              </label>
              <label className="timeline-select">
                Category
                <select
                  aria-label="Vault category filter"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {Object.entries(labels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="timeline-select">
                Person
                <select
                  aria-label="Vault person filter"
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                >
                  <option value="">All people</option>
                  {people.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          {selected?.can_manage && vault.data && (
            <UploadPanel
              key={selected.id}
              collection={selected}
              people={people.data ?? []}
              capabilities={vault.data.capabilities}
              done={refresh}
            />
          )}
          <h2 className="interview-section-title">
            {selected ? "Files in this folder" : "Your permitted files"}
          </h2>
          {files.length ? (
            <div className="vault-file-grid">
              {files.map((file) => (
                <VaultFileCard
                  key={`${file.id}:${file.status}`}
                  file={file}
                  people={people.data ?? []}
                  refresh={refresh}
                />
              ))}
            </div>
          ) : (
            <section className="founder-empty">
              <LockKeyhole size={24} />
              <h2>No permitted files here</h2>
              <p>
                {selected
                  ? "Upload an original, open a nested folder, or clear your filters."
                  : "Create a private collection to begin. Files you cannot access never appear here."}
              </p>
            </section>
          )}
        </>
      )}
      <details className="founder-form-card">
        <summary>Vault permissions associated with you</summary>
        <p className="legacy-note">
          You can withdraw permission for uploaded originals you own or that are associated with
          your linked person profile, without gaining access to a private collection. Withdrawal is
          permanent and erases the uploaded original; copies already downloaded cannot be recalled.
          Audio consent remains in the existing recording consent controls.
        </p>
        {consents.data?.map((c) => (
          <div className="vault-consent-row" key={c.id}>
            <span>
              {c.label} · {c.id.slice(0, 8)} {c.revoked_at ? "· Withdrawn" : ""}
            </span>
            {!c.revoked_at && (
              <button
                className="legacy-button"
                disabled={revoke.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Permanently withdraw permission and erase this uploaded original?",
                    )
                  )
                    revoke.mutate(c.id);
                }}
              >
                Withdraw permission
              </button>
            )}
          </div>
        ))}
        {!consents.data?.length && (
          <p className="legacy-note">No vault originals are associated with your profile yet.</p>
        )}
      </details>
    </>
  );
}

function CollectionEditor({ collection, done }: { collection: VaultCollection; done: () => void }) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");
  const save = useMutation({
    mutationFn: () =>
      request(`/v1/vault/collections/${collection.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description }),
      }),
    onSuccess: done,
  });
  return (
    <form
      className="founder-form"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label>
        Collection name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} required />
      </label>
      <label>
        Collection description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
        />
      </label>
      <button className="legacy-button" disabled={save.isPending || !name.trim()}>
        Save collection details
      </button>
      {save.isError && (
        <p className="legacy-error" role="alert">
          {save.error.message}
        </p>
      )}
    </form>
  );
}

const emptyMetadata = {
  title: "",
  description: "",
  person_id: "",
  occurred_on: "",
  category: "document",
};
type Metadata = typeof emptyMetadata;
function MetadataFields({
  value,
  change,
  people,
}: {
  value: Metadata;
  change: (value: Metadata) => void;
  people: Person[];
}) {
  return (
    <>
      <label>
        File title
        <input
          required
          maxLength={160}
          value={value.title}
          onChange={(e) => change({ ...value, title: e.target.value })}
        />
      </label>
      <label>
        File category
        <select
          aria-label="File category"
          value={value.category}
          onChange={(e) => change({ ...value, category: e.target.value })}
        >
          {Object.entries(labels)
            .filter(([k]) => k !== "audio")
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
      </label>
      <label>
        Associated person
        <select
          aria-label="Associated person"
          value={value.person_id}
          onChange={(e) => change({ ...value, person_id: e.target.value })}
        >
          <option value="">Not associated</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Heritage date
        <input
          type="date"
          value={value.occurred_on}
          onChange={(e) => change({ ...value, occurred_on: e.target.value })}
        />
      </label>
      <label className="founder-form-wide">
        File description
        <textarea
          rows={3}
          maxLength={4000}
          value={value.description}
          onChange={(e) => change({ ...value, description: e.target.value })}
        />
      </label>
    </>
  );
}
function metadataBody(value: Metadata) {
  return {
    ...value,
    title: value.title.trim(),
    person_id: value.person_id || null,
    occurred_on: value.occurred_on || null,
  };
}

function UploadPanel({
  collection,
  people,
  capabilities,
  done,
}: {
  collection: VaultCollection;
  people: Person[];
  capabilities: VaultPayload["capabilities"];
  done: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState(emptyMetadata);
  const [rights, setRights] = useState(false);
  const [audioPicker, setAudioPicker] = useState(false);
  const [recordingId, setRecordingId] = useState("");
  const [notice, setNotice] = useState("");
  const recordings = useQuery({
    queryKey: ["vault-recordings"],
    queryFn: () => request<Recording[]>("/v1/recordings"),
    enabled: audioPicker,
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !rights) throw new Error("Choose a file and confirm permission first.");
      if (file.size > capabilities.max_bytes || !file.size)
        throw new Error("Choose a non-empty file of at most 25 MB.");
      const suffix = `.${file.name.split(".").pop()?.toLowerCase()}`;
      const type = capabilities.file_types[suffix];
      if (!type)
        throw new Error(
          "Choose JPEG, PNG, WebP, PDF, or UTF-8 text. Use the existing recorder for audio.",
        );
      const item = await request<VaultFile>(`/v1/vault/collections/${collection.id}/files`, {
        method: "POST",
        body: JSON.stringify({
          ...metadataBody(metadata),
          filename: file.name,
          media_type: type,
          size_bytes: file.size,
          rights_confirmed: rights,
        }),
      });
      await request(`/v1/vault/files/${item.id}/content`, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": type },
      });
    },
    onSuccess: () => {
      done();
      setOpen(false);
      setFile(null);
      setMetadata(emptyMetadata);
      setRights(false);
      setNotice("Original saved in the private vault.");
    },
    onError: () => done(),
  });
  const audio = useMutation({
    mutationFn: () =>
      request(`/v1/vault/collections/${collection.id}/recordings`, {
        method: "POST",
        body: JSON.stringify({ recording_id: recordingId }),
      }),
    onSuccess: () => {
      done();
      setAudioPicker(false);
      setRecordingId("");
      setNotice("Recording reference added without changing source permissions.");
    },
  });
  return (
    <section className="founder-form-card">
      <div className="founder-actions">
        <button
          className="legacy-button legacy-button--primary"
          disabled={!capabilities.upload_enabled}
          onClick={() => {
            setOpen(!open);
            setNotice("");
          }}
        >
          <Upload size={15} /> Upload an original
        </button>
        <button className="legacy-button" onClick={() => setAudioPicker(!audioPicker)}>
          Add permitted audio
        </button>
      </div>
      <p className="legacy-note">
        JPEG, PNG, WebP, PDF, and UTF-8 text · up to 25 MB per original. No archives, executable
        files, HTML, SVG, or office macros. Video upload is not available in the current
        infrastructure.
      </p>
      {notice && (
        <p className="founder-notice" role="status">
          {notice}
        </p>
      )}
      {open && (
        <form
          className="founder-form"
          onSubmit={(e) => {
            e.preventDefault();
            upload.mutate();
          }}
        >
          <label className="founder-form-wide">
            Original file
            <input
              type="file"
              required
              accept={Object.keys(capabilities.file_types).join(",")}
              disabled={upload.isPending}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setRights(false);
              }}
            />
          </label>
          <MetadataFields value={metadata} change={setMetadata} people={people} />
          <label className="interview-review-check founder-form-wide">
            <input
              type="checkbox"
              required
              checked={rights}
              onChange={(e) => setRights(e.target.checked)}
            />{" "}
            I have permission to store this material and associate the named person. I understand
            this collection is{" "}
            {collection.visibility === "family" ? "shared with the family" : "private to me"}.
          </label>
          <div className="founder-form-actions founder-form-wide">
            <button
              className="legacy-button"
              type="button"
              disabled={upload.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              className="legacy-button legacy-button--primary"
              disabled={upload.isPending || !file || !rights || !metadata.title.trim()}
            >
              {upload.isPending ? "Validating and saving…" : "Save original"}
            </button>
          </div>
          {upload.isError && (
            <p className="legacy-error founder-form-wide" role="alert">
              {upload.error.message} A pending item may remain below; delete it before starting a
              new upload.
            </p>
          )}
        </form>
      )}
      {audioPicker && (
        <div className="founder-picker">
          <p className="legacy-note">
            Upload audio with the existing consent-aware recorder, then select it here. Shared
            collections never override recording grants or withdrawn consent.
          </p>
          <Link className="legacy-button" href={`/app/record?family=${collection.family_id}`}>
            Open audio recorder / upload →
          </Link>
          <label className="interview-label">
            Permitted recording
            <select
              aria-label="Permitted recording"
              value={recordingId}
              onChange={(e) => setRecordingId(e.target.value)}
            >
              <option value="">Choose a permitted recording</option>
              {recordings.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <button
            className="legacy-button"
            disabled={audio.isPending || !recordingId}
            onClick={() => audio.mutate()}
          >
            Link recording
          </button>
          {(audio.error || recordings.error) && (
            <p className="legacy-error" role="alert">
              {(audio.error || recordings.error)!.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function VaultFileCard({
  file,
  people,
  refresh,
}: {
  file: VaultFile;
  people: Person[];
  refresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [metadata, setMetadata] = useState<Metadata>({
    title: file.title,
    description: file.description ?? "",
    category: file.category ?? "document",
    person_id: file.person_id ?? "",
    occurred_on: file.occurred_on ?? "",
  });
  const download = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/v1/vault/files/${file.id}/download`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail ?? "This original is not available under your current permissions.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename ?? "recording-original.audio";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const remove = useMutation({
    mutationFn: () => request(`/v1/vault/files/${file.id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const save = useMutation({
    mutationFn: () =>
      request(`/v1/vault/files/${file.id}`, {
        method: "PATCH",
        body: JSON.stringify(metadataBody(metadata)),
      }),
    onSuccess: () => {
      refresh();
      setEditing(false);
    },
  });
  const error = download.error || remove.error || save.error;
  return (
    <article className="vault-file">
      <span className="legacy-eyebrow">
        {file.status === "revoked" ? "Permission withdrawn" : labels[file.category ?? "document"]}
      </span>
      <h3>{file.title}</h3>
      <p className="vault-file-description">{file.description}</p>
      <p className="legacy-note">
        {[
          file.person_name,
          file.occurred_on,
          file.filename,
          file.size_bytes ? `${(file.size_bytes / 1024).toFixed(1)} KB` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {file.status === "pending" && (
        <p className="vault-warning">
          Pending upload — not downloadable. Delete failed uploads; pending reservations expire
          after 24 hours.
        </p>
      )}
      {file.status === "ready" && !file.recording_id && !file.scanned && (
        <p className="legacy-note">
          Not malware-scanned in development. Downloads are forced attachments, not previews.
        </p>
      )}
      <div className="founder-actions">
        {file.status === "ready" && file.download_original && (
          <button
            className="legacy-button"
            disabled={download.isPending}
            onClick={() => download.mutate()}
          >
            <Download size={14} /> Download original
          </button>
        )}
        {file.recording_id && (
          <Link className="legacy-button" href={`/app/recordings/${file.recording_id}`}>
            Open permitted recording
          </Link>
        )}
        {file.can_manage && !file.recording_id && file.status === "ready" && (
          <button className="legacy-button" onClick={() => setEditing(!editing)}>
            Edit metadata
          </button>
        )}
        {file.can_manage && (
          <button
            className="legacy-button"
            disabled={remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  file.recording_id
                    ? "Remove this reference? The original recording is not deleted."
                    : "Delete this original? Access stops immediately and storage erasure is retried if necessary.",
                )
              )
                remove.mutate();
            }}
          >
            Delete item
          </button>
        )}
      </div>
      {editing && (
        <form
          className="founder-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <MetadataFields value={metadata} change={setMetadata} people={people} />
          <div className="founder-form-actions founder-form-wide">
            <button className="legacy-button" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="legacy-button" disabled={save.isPending || !metadata.title.trim()}>
              Save metadata
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="legacy-error" role="alert">
          {error.message}
        </p>
      )}
    </article>
  );
}
