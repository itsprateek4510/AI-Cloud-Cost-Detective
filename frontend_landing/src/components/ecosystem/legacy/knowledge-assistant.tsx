"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { BookOpenCheck, ShieldCheck, Sparkles } from "lucide-react";
import { request } from "@/lib/api";
import type { Family, LegacyAnswer } from "@/lib/domain";
import { useApp } from "../provider";

const SAMPLE_QUESTIONS = [
  "How did our family business begin?",
  "What lessons did our grandfather teach?",
  "What were our family's major milestones?",
  "What values did our founder emphasize?",
  "What challenges did previous generations face?",
];

type Exchange = { question: string; answer: LegacyAnswer };

export function LegacyKnowledgeAssistant() {
  const { families, family, setFamily } = useApp();
  return (
    <div className="legacy">
      <header className="legacy-head">
        <div>
          <Link className="legacy-back" href="/app/legacy">
            ← Heritage dashboard
          </Link>
          <span className="legacy-eyebrow">Grounded in what your family recorded</span>
          <h1>Family Legacy Assistant</h1>
          <p className="legacy-sub">
            Ask about the family business, lessons, milestones, values, and challenges. Every answer
            cites confirmed memories the whole family has shared; if the archive does not support an
            answer, the assistant says so.
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
        <AssistantPanel key={family.id} family={family} />
      ) : (
        <section className="founder-empty">
          <h2>No family yet</h2>
          <p>Create a family and share confirmed memories before asking the archive.</p>
          <Link href="/onboarding">Create a family →</Link>
        </section>
      )}
    </div>
  );
}

function AssistantPanel({ family }: { family: Family }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const ask = useMutation({
    mutationFn: (value: string) =>
      request<LegacyAnswer>(`/v1/families/${family.id}/legacy-assistant/ask`, {
        method: "POST",
        body: JSON.stringify({ question: value }),
      }),
    onSuccess: (answer, value) => {
      setHistory((previous) => [...previous, { question: value, answer }]);
      setQuestion("");
    },
  });
  const trimmed = question.trim();
  return (
    <div className="assistant-layout">
      <section className="founder-form-card assistant-ask">
        <h2>Ask the family archive</h2>
        <p className="legacy-note">
          Answers use only confirmed memories visible to every active family member. Private
          conversations, private recordings, unconfirmed suggestions, and uploaded document text are
          never searched.
        </p>
        <div className="assistant-samples" aria-label="Example questions">
          {SAMPLE_QUESTIONS.map((sample) => (
            <button
              key={sample}
              type="button"
              className="assistant-sample"
              onClick={() => setQuestion(sample)}
            >
              {sample}
            </button>
          ))}
        </div>
        <form
          className="founder-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) ask.mutate(trimmed);
          }}
        >
          <label className="assistant-question">
            Your question
            <textarea
              aria-label="Your question"
              rows={4}
              maxLength={2000}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What values did our founder emphasize?"
            />
          </label>
          <div className="founder-form-actions">
            <button
              type="submit"
              className="legacy-button legacy-button--primary"
              disabled={ask.isPending || !trimmed}
            >
              <Sparkles size={15} /> {ask.isPending ? "Searching permitted memories…" : "Ask"}
            </button>
            <button
              type="button"
              className="legacy-button"
              disabled={ask.isPending || !history.length}
              onClick={() => setHistory([])}
            >
              Clear this session
            </button>
          </div>
        </form>
        {ask.isError && (
          <p className="legacy-error" role="alert">
            {ask.error.message}
          </p>
        )}
        <p className="legacy-note assistant-disclaimer">
          This is not the personal chat. Nothing you ask or receive here is saved to a conversation
          or creates a memory. AI can make mistakes; follow the citations to review the source
          memory.
        </p>
      </section>

      <section className="assistant-answers" aria-live="polite">
        {!history.length && !ask.isPending && (
          <div className="assistant-empty">
            <BookOpenCheck size={26} />
            <h2>No question yet</h2>
            <p>
              Start with a story your family has already confirmed and shared. The answer will show
              exactly which memories support it.
            </p>
          </div>
        )}
        {ask.isPending && (
          <p className="legacy-loading" aria-busy="true">
            Looking through confirmed family memories…
          </p>
        )}
        {history.map((exchange, index) => (
          <article className="assistant-answer" key={`${index}:${exchange.question}`}>
            <span className="legacy-eyebrow">Question</span>
            <h2>{exchange.question}</h2>
            {exchange.answer.refusal ? (
              <div className="assistant-refusal">
                <ShieldCheck size={18} />
                <p>{exchange.answer.answer}</p>
              </div>
            ) : (
              <>
                <p className="assistant-answer-text">{exchange.answer.answer}</p>
                <div className="assistant-verified">
                  <ShieldCheck size={15} />
                  Verified against {exchange.answer.citations.length} permitted{" "}
                  {exchange.answer.citations.length === 1 ? "memory" : "memories"}
                </div>
                <h3>Citations</h3>
                <ol className="assistant-citations">
                  {exchange.answer.citations.map((citation) => (
                    <li key={citation.memory_id}>
                      <Link href={`/app/memory/${citation.memory_id}`}>
                        {citation.subject_name ? `${citation.subject_name}: ` : ""}
                        {citation.summary}
                      </Link>
                      <span>
                        {citation.kind}
                        {citation.as_of_date ? ` · ${citation.as_of_date}` : ""} · {citation.level}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
