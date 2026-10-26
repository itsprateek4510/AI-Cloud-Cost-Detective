"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, ShieldCheck } from "lucide-react";
import { request } from "@/lib/api";
import type { BookSummary, BookTemplate, Member, Person } from "@/lib/domain";
import { useApp } from "../provider";

const TEMPLATES: { value: BookTemplate; label: string; note: string }[] = [
  {
    value: "classic_heritage",
    label: "Classic Heritage",
    note: "Warm ivory pages, serif typography, and restrained gold rules.",
  },
  {
    value: "modern_legacy",
    label: "Modern Legacy",
    note: "Crisp sans-serif type, generous space, and a contemporary navy accent.",
  },
  {
    value: "founder_biography",
    label: "Founder Biography",
    note: "A focused, editorial treatment for a founder's life and business journey.",
  },
];

export function BooksIndex() {
  const { families, family, setFamily } = useApp();
  return (
    <div className="legacy">
      <header className="legacy-head">
        <div>
          <Link className="legacy-back" href="/app/legacy">
            ← Heritage dashboard
          </Link>
          <span className="legacy-eyebrow">Smriti Legacy</span>
          <h1>Heritage Book Studio</h1>
          <p className="legacy-sub">
            Shape approved family stories into a private, professionally formatted book. Every
            chapter is editable and stays a draft until you approve it.
          </p>
        </div>
        {families.length > 1 && (
          <label className="legacy-family-picker">
            Family
            <select
              aria-label="Family"
              value={family?.id}
              onChange={(event) => setFamily(event.target.value)}
            >
              {families.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {family ? (
        <BookIndex key={family.id} familyId={family.id} />
      ) : (
        <section className="founder-empty">
          <h2>No family yet</h2>
          <p>Create a family before starting a heritage book.</p>
          <Link href="/onboarding">Create a family →</Link>
        </section>
      )}
    </div>
  );
}

function BookIndex({ familyId }: { familyId: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [template, setTemplate] = useState<BookTemplate>("classic_heritage");
  const [audience, setAudience] = useState<string[] | null>(null);
  const [persons, setPersons] = useState<string[] | null>(null);
  const books = useQuery({
    queryKey: ["books", familyId],
    queryFn: () => request<BookSummary[]>(`/v1/families/${familyId}/books`),
  });
  const members = useQuery({
    queryKey: ["legacy-members", familyId],
    queryFn: () => request<Member[]>(`/v1/families/${familyId}/members`),
  });
  const people = useQuery({
    queryKey: ["legacy-persons", familyId],
    queryFn: () => request<Person[]>(`/v1/families/${familyId}/persons`),
  });
  const selectedAudience = audience ?? members.data?.map((member) => member.id) ?? [];
  const selectedPersons = persons ?? people.data?.map((person) => person.id) ?? [];
  const create = useMutation({
    mutationFn: () =>
      request<{ id: string }>(`/v1/families/${familyId}/books`, {
        method: "POST",
        body: JSON.stringify({
          title,
          subtitle,
          template,
          audience_user_ids: selectedAudience,
          person_ids: selectedPersons,
        }),
      }),
    onSuccess: (book) => {
      void client.invalidateQueries({ queryKey: ["books", familyId] });
      router.push(`/app/legacy/books/${book.id}`);
    },
  });
  const error = books.error || members.error || people.error || create.error;
  return (
    <>
      <p className="founder-notice">
        <ShieldCheck size={16} /> Books are private to the person who creates them. A PDF is
        generated only after you approve every chapter, stored privately, and can be revoked.
        Nothing is published publicly or sent to a printer.
      </p>
      <div className="book-index-grid">
        <section className="founder-form-card">
          <h2>Start a book project</h2>
          <form
            className="founder-form"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <label>
              Book title
              <input
                required
                maxLength={160}
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
            <fieldset className="book-fieldset founder-form-wide">
              <legend>Design template</legend>
              {TEMPLATES.map((item) => (
                <label key={item.value} className="book-choice">
                  <input
                    type="radio"
                    name="template"
                    value={item.value}
                    checked={template === item.value}
                    onChange={() => setTemplate(item.value)}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.note}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="book-fieldset founder-form-wide">
              <legend>Intended audience</legend>
              <p className="legacy-note">
                A source is included only if every selected reader can still access it.
              </p>
              {members.data?.map((member) => (
                <label key={member.id} className="book-check">
                  <input
                    type="checkbox"
                    checked={selectedAudience.includes(member.id)}
                    onChange={(event) =>
                      setAudience(
                        event.target.checked
                          ? [...selectedAudience, member.id]
                          : selectedAudience.filter((id) => id !== member.id),
                      )
                    }
                  />
                  {member.name} · {member.role}
                </label>
              ))}
            </fieldset>
            <fieldset className="book-fieldset founder-form-wide">
              <legend>Family members featured</legend>
              <div className="book-check-grid">
                {people.data?.map((person) => (
                  <label key={person.id} className="book-check">
                    <input
                      type="checkbox"
                      checked={selectedPersons.includes(person.id)}
                      onChange={(event) =>
                        setPersons(
                          event.target.checked
                            ? [...selectedPersons, person.id]
                            : selectedPersons.filter((id) => id !== person.id),
                        )
                      }
                    />
                    {person.display_name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="founder-form-actions founder-form-wide">
              <button
                className="legacy-button legacy-button--primary"
                disabled={create.isPending || !title.trim()}
              >
                <Plus size={15} /> {create.isPending ? "Creating…" : "Create book project"}
              </button>
            </div>
          </form>
          {error && (
            <p className="legacy-error" role="alert">
              {error.message}
            </p>
          )}
        </section>
        <section className="founder-form-card">
          <h2>Your books</h2>
          {books.isPending ? (
            <p className="legacy-note">Opening book projects…</p>
          ) : books.data?.length ? (
            <div className="book-list">
              {books.data.map((book) => (
                <Link
                  key={book.id}
                  href={`/app/legacy/books/${book.id}`}
                  className="book-list-item"
                >
                  <BookOpen size={20} />
                  <span>
                    <strong>{book.title}</strong>
                    <small>
                      {book.template_label} · {book.chapter_count} chapters ·{" "}
                      {book.status === "approved" ? "approved" : "draft"}
                      {book.export_ready ? " · PDF ready" : ""}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            !books.isError && (
              <div className="legacy-empty">
                <BookOpen size={24} />
                <strong>No heritage book yet</strong>
                <p>Create a private project, then choose approved stories and photographs.</p>
              </div>
            )
          )}
        </section>
      </div>
    </>
  );
}
