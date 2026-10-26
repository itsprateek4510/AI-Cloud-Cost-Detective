"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { request } from "@/lib/api";
import type {
  Interview,
  InterviewAssistance,
  InterviewCandidate,
  InterviewDetail,
  InterviewTheme,
  Person,
  Recording,
  Segment,
} from "@/lib/domain";
import { useApp } from "../provider";

export function LegacyInterviews() {
  const { families, family, setFamily } = useApp();
  return (
    <div className="legacy">
      <header className="legacy-head">
        <div>
          <Link className="legacy-back" href="/app/legacy">
            ← Heritage dashboard
          </Link>
          <span className="legacy-eyebrow">In their own words</span>
          <h1>AI Legacy Interviews</h1>
          <p className="legacy-sub">
            Make room for the stories only they can tell. Guided questions work without AI; your
            private archive grows only when you choose what to keep.
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
        <InterviewIndex key={family.id} familyId={family.id} />
      ) : (
        <section className="founder-empty">
          <h2>No family yet</h2>
          <p>Add a family and an interview subject to begin.</p>
          <Link href="/onboarding">Create a family →</Link>
        </section>
      )}
    </div>
  );
}

function InterviewIndex({ familyId }: { familyId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [theme, setTheme] = useState("childhood");
  const people = useQuery({
    queryKey: ["legacy-persons", familyId],
    queryFn: () => request<Person[]>(`/v1/families/${familyId}/persons`),
  });
  const themes = useQuery({
    queryKey: ["interview-themes"],
    queryFn: () => request<InterviewTheme[]>("/v1/interview-themes"),
  });
  const sessions = useQuery({
    queryKey: ["interviews", familyId],
    queryFn: () => request<Interview[]>(`/v1/families/${familyId}/interviews`),
  });
  const create = useMutation({
    mutationFn: () =>
      request<InterviewDetail>(`/v1/families/${familyId}/interviews`, {
        method: "POST",
        body: JSON.stringify({ title, subject_person_id: subject, theme }),
      }),
    onSuccess: (interview) => router.push(`/app/legacy/interviews/${interview.id}`),
  });
  const error = people.error || themes.error || sessions.error || create.error;
  return (
    <>
      <section className="founder-form-card">
        <h2>Begin a meaningful conversation</h2>
        <p className="legacy-note">
          Only you can open your sessions and summaries. Recording someone requires their consent.
          They may pause, skip a question, or withdraw consent at any time.
        </p>
        <form
          className="founder-form"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label>
            Interview title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              required
            />
          </label>
          <label>
            Interview subject
            <select
              aria-label="Interview subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            >
              <option value="">Choose a family person</option>
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Interview theme
            <select
              aria-label="Interview theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              {themes.data?.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="founder-form-actions founder-form-wide">
            <button
              className="legacy-button legacy-button--primary"
              disabled={create.isPending || !subject || !title.trim() || !themes.data}
            >
              <Plus size={15} /> Start interview
            </button>
          </div>
        </form>
      </section>
      {error && (
        <p className="legacy-error" role="alert">
          {error.message}
        </p>
      )}
      <h2 className="interview-section-title">Your private interviews</h2>
      {sessions.isPending ? (
        <p aria-busy="true">Opening interviews…</p>
      ) : sessions.data?.length ? (
        <div className="founder-cards">
          {sessions.data.map((s) => (
            <article key={s.id} className="founder-card">
              <span className="legacy-eyebrow">{s.theme_label}</span>
              <h3>{s.title}</h3>
              <p>{s.subject_name}</p>
              <Link className="founder-card-link" href={`/app/legacy/interviews/${s.id}`}>
                Open interview →
              </Link>
            </article>
          ))}
        </div>
      ) : (
        !sessions.isError && (
          <p className="legacy-note">No interviews yet. Choose a subject and a theme above.</p>
        )
      )}
    </>
  );
}

export function LegacyInterview({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: ["interview", id],
    queryFn: () => request<InterviewDetail>(`/v1/interviews/${id}`),
    refetchInterval: 5000,
  });
  return (
    <div className="legacy">
      <Link className="legacy-back" href="/app/legacy/interviews">
        ← Your interviews
      </Link>
      {detail.isPending ? (
        <h1>Opening interview…</h1>
      ) : detail.isError ? (
        <p className="legacy-error" role="alert">
          {detail.error.message}
        </p>
      ) : (
        <InterviewEditor
          key={`${id}:${detail.data.updated_at}:${detail.data.source_fingerprint}`}
          interview={detail.data}
        />
      )}
    </div>
  );
}

function InterviewEditor({ interview }: { interview: InterviewDetail }) {
  const client = useQueryClient();
  const router = useRouter();
  const { user } = useApp();
  const [summary, setSummary] = useState(interview.summary ?? "");
  const [fingerprint, setFingerprint] = useState(interview.source_fingerprint);
  const [draft, setDraft] = useState<InterviewAssistance | null>(null);
  const [question, setQuestion] = useState(interview.questions[0] ?? "");
  const [attachId, setAttachId] = useState("");
  const [notice, setNotice] = useState("");
  const [picker, setPicker] = useState(false);
  const refresh = () => client.invalidateQueries({ queryKey: ["interview", interview.id] });
  const recordings = useQuery({
    queryKey: ["interview-recordings", interview.id],
    queryFn: () => request<Recording[]>("/v1/recordings"),
    enabled: picker,
  });
  const assist = useMutation({
    mutationFn: () =>
      request<InterviewAssistance>(`/v1/interviews/${interview.id}/assist`, { method: "POST" }),
    onSuccess: (value) => {
      setDraft(value);
      setSummary(value.summary);
      setFingerprint(value.source_fingerprint);
      setNotice("AI draft ready. Check every claim against the transcript before saving.");
    },
  });
  const save = useMutation({
    mutationFn: () =>
      request(`/v1/interviews/${interview.id}`, {
        method: "PATCH",
        body: JSON.stringify({ summary, source_fingerprint: fingerprint }),
      }),
    onSuccess: () => {
      setNotice("Summary saved as a private, editable draft.");
      void refresh();
    },
  });
  const attach = useMutation({
    mutationFn: () =>
      request(`/v1/interviews/${interview.id}/responses`, {
        method: "POST",
        body: JSON.stringify({ recording_id: attachId, question }),
      }),
    onSuccess: () => {
      void refresh();
      setPicker(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => request(`/v1/interviews/${interview.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["interviews"] });
      router.push("/app/legacy/interviews");
    },
  });
  const error = assist.error || save.error || attach.error || remove.error || recordings.error;
  const recordUrl = `/app/record?${new URLSearchParams({ interview: interview.id, person: interview.subject_person_id, family: interview.family_id, question })}`;
  const attached = new Set(interview.responses.map((r) => r.recording_id));
  const eligible =
    recordings.data?.filter(
      (r) =>
        r.owner_user_id === user.id &&
        r.space_id === interview.space_id &&
        r.subject_person_id === interview.subject_person_id &&
        !attached.has(r.id),
    ) ?? [];
  return (
    <>
      <header className="legacy-head">
        <div>
          <span className="legacy-eyebrow">{interview.theme_label}</span>
          <h1>{interview.title}</h1>
          <p className="legacy-sub">
            A conversation with {interview.subject_name}. Only you can read this interview;
            attaching a recording does not change its sharing permissions.
          </p>
        </div>
      </header>
      <p className="founder-notice">
        <ShieldCheck size={16} /> Ask permission first. Pause, skip, or stop whenever the subject
        wishes. No memories are saved automatically.
      </p>
      <div className="interview-layout">
        <section className="founder-form-card">
          <h2>Guided questions</h2>
          <p className="legacy-note">
            These are conversation starters, not a checklist. Let the answer lead.
          </p>
          <ol className="interview-questions">
            {interview.questions.map((q) => (
              <li key={q}>
                <button
                  className="legacy-button"
                  aria-pressed={q === question}
                  onClick={() => setQuestion(q)}
                >
                  {q}
                </button>
              </li>
            ))}
          </ol>
          {!!draft?.followups.length && (
            <>
              <h3>Suggested follow-ups</h3>
              <ul className="interview-questions">
                {draft.followups.map((q, i) => (
                  <li key={i}>
                    <button className="legacy-button" onClick={() => setQuestion(q)}>
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <label className="interview-label">
            Question to ask
            <textarea
              aria-label="Question to ask"
              maxLength={1000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          {question.trim() && (
            <Link className="legacy-button legacy-button--primary" href={recordUrl}>
              <Mic size={15} /> Record response
            </Link>
          )}
          <p className="legacy-note">
            Uses the existing recorder, consent controls, and transcription pipeline. Without AI
            credentials, audio can still be saved; automatic transcription waits for the existing
            speech service.
          </p>
          <button className="legacy-button" onClick={() => setPicker(!picker)}>
            Attach an existing response
          </button>
          {picker && (
            <div className="founder-picker">
              <p className="legacy-note">
                Only your private recordings of this subject are eligible. Previous suggestions from
                an older recording are not deleted; no further automatic extraction runs.
              </p>
              <label className="interview-label">
                Response recording
                <select
                  aria-label="Response recording"
                  value={attachId}
                  onChange={(e) => setAttachId(e.target.value)}
                >
                  <option value="">Choose a recording</option>
                  {eligible.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
              {recordings.isPending ? (
                <p>Loading recordings…</p>
              ) : (
                !eligible.length && <p>No eligible recordings yet.</p>
              )}
              <button
                className="legacy-button"
                disabled={!attachId || !question.trim() || attach.isPending}
                onClick={() => attach.mutate()}
              >
                Attach response
              </button>
            </div>
          )}
        </section>
        <section className="founder-form-card">
          <h2>Interview summary</h2>
          <p className="legacy-note">
            A private, editable draft — not a confirmed memory. AI uses only the current, permitted
            transcripts and can make mistakes. You can write this yourself.
          </p>
          {interview.summary_withheld && (
            <p className="legacy-error" role="note">
              The previous summary is withheld because a source changed or is unavailable. Review
              the responses before writing a fresh draft.
            </p>
          )}
          <label className="interview-label">
            Editable summary
            <textarea
              rows={12}
              maxLength={12000}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <div className="founder-actions">
            <button
              className="legacy-button legacy-button--primary"
              disabled={save.isPending || !fingerprint || assist.isPending}
              onClick={() => save.mutate()}
            >
              Save summary
            </button>
            <button
              className="legacy-button"
              disabled={
                assist.isPending || !interview.sources_available || !interview.responses.length
              }
              onClick={() => {
                if (
                  summary !== (interview.summary ?? "") &&
                  !window.confirm("Replace your unsaved summary with a new AI draft?")
                )
                  return;
                assist.mutate();
              }}
            >
              <Sparkles size={15} />{" "}
              {assist.isPending ? "Preparing…" : "Draft summary & follow-ups"}
            </button>
          </div>
          <p className="legacy-note">
            If AI is unavailable, keep interviewing and save a manual summary. Nothing is sent to AI
            until you request a draft.
          </p>
        </section>
      </div>
      {error && (
        <p className="legacy-error" role="alert">
          {error.message}
        </p>
      )}
      {notice && (
        <p className="founder-notice" role="status">
          {notice}
        </p>
      )}
      <section className="founder-form-card">
        <h2>Responses & transcript review</h2>
        <p className="legacy-note">
          Review or correct each response in the existing transcript editor. Corrections invalidate
          summaries and excerpt proposals. Select an exact excerpt to create a private suggested
          memory; confirmation and sharing remain separate actions in Stories Smriti remembers.
        </p>
        {!interview.responses.length && (
          <p>No responses yet. Choose a question and open the recorder.</p>
        )}
        {interview.responses.map((response) =>
          response.available && response.recording_id ? (
            <ResponseReview
              key={response.id}
              response={response}
              interviewId={interview.id}
              candidates={draft?.candidates ?? []}
            />
          ) : (
            <p key={response.id} className="founder-source-unavailable">
              A response is unavailable under its current access or consent. Its title and content
              are withheld.
            </p>
          ),
        )}
      </section>
      <button
        className="legacy-button interview-delete"
        disabled={remove.isPending}
        onClick={() => {
          if (
            window.confirm(
              "Delete this interview and its summary? Original recordings and reviewed memories remain in your archive.",
            )
          )
            remove.mutate();
        }}
      >
        Delete interview
      </button>
    </>
  );
}

type ResponseRow = InterviewDetail["responses"][number];
function ResponseReview({
  response,
  interviewId,
  candidates,
}: {
  response: ResponseRow;
  interviewId: string;
  candidates: InterviewCandidate[];
}) {
  const [review, setReview] = useState(false);
  const transcript = useQuery({
    queryKey: ["interview-transcript", response.recording_id],
    queryFn: () => request<Segment[]>(`/v1/recordings/${response.recording_id}/transcript`),
    enabled: review && response.status === "ready",
    refetchInterval: review ? 5000 : false,
  });
  return (
    <article className="interview-response">
      <span className="legacy-eyebrow">{response.status}</span>
      <h3>{response.question}</h3>
      <p>{response.title}</p>
      <div className="founder-actions">
        <Link className="legacy-button" href={`/app/recordings/${response.recording_id}`}>
          Open audio & correct transcript
        </Link>
        <button className="legacy-button" onClick={() => setReview(!review)}>
          {review ? "Close excerpt review" : "Review excerpts"}
        </button>
      </div>
      {review && (
        <>
          {response.status !== "ready" && (
            <p>
              Transcription is not ready. Audio is preserved even when AI is unavailable. Open the
              recording for processing status or retry.
            </p>
          )}
          {transcript.isError && (
            <p className="legacy-error" role="alert">
              {transcript.error.message}
            </p>
          )}
          {transcript.isFetching && !transcript.data && <p>Opening transcript…</p>}
          {transcript.data?.map((segment) => (
            <ExcerptReview
              key={`${segment.id}:${segment.edited_text ?? segment.text}:${candidates.find((c) => c.segment_id === segment.id)?.summary ?? "manual"}`}
              segment={segment}
              interviewId={interviewId}
              candidate={candidates.find((c) => c.segment_id === segment.id)}
            />
          ))}
          {transcript.data?.length === 0 && <p>No transcript segments yet.</p>}
        </>
      )}
    </article>
  );
}

function ExcerptReview({
  segment,
  interviewId,
  candidate,
}: {
  segment: Segment;
  interviewId: string;
  candidate?: InterviewCandidate;
}) {
  const [summary, setSummary] = useState(candidate?.summary ?? "");
  const [quote, setQuote] = useState(
    candidate?.quote ?? (segment.edited_text ?? segment.text).slice(0, 5000),
  );
  const [reviewed, setReviewed] = useState(false);
  const [saved, setSaved] = useState("");
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: () =>
      request<{ id: string }>(`/v1/interviews/${interviewId}/memories`, {
        method: "POST",
        body: JSON.stringify({ segment_id: segment.id, summary, quote, reviewed }),
      }),
    onSuccess: (memory) => {
      setSaved(memory.id);
      void client.invalidateQueries({ queryKey: ["memories"] });
    },
  });
  return (
    <div className="interview-excerpt">
      <blockquote>{segment.edited_text ?? segment.text}</blockquote>
      {saved ? (
        <p role="status">
          Private suggested memory created.{" "}
          <Link href={`/app/memory/${saved}`}>Review and confirm this memory →</Link>
        </p>
      ) : (
        <>
          {candidate && (
            <p className="legacy-note">
              AI-proposed excerpt. Verify the summary yourself; quoting a source does not prove
              every claim in the summary.
            </p>
          )}
          <label className="interview-label">
            Exact transcript quote
            <textarea
              maxLength={5000}
              value={quote}
              onChange={(e) => {
                setQuote(e.target.value);
                setReviewed(false);
              }}
            />
          </label>
          <label className="interview-label">
            Memory summary
            <textarea
              maxLength={5000}
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                setReviewed(false);
              }}
            />
          </label>
          <label className="interview-review-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />{" "}
            I reviewed this excerpt and summary and choose to create a private suggested memory.
          </label>
          <button
            className="legacy-button"
            disabled={create.isPending || !reviewed || !summary.trim() || !quote.trim()}
            onClick={() => create.mutate()}
          >
            Create reviewed memory
          </button>
          {create.isError && (
            <p className="legacy-error" role="alert">
              {create.error.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
