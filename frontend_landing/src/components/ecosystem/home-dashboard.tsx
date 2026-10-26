"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Mic,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { request } from "@/lib/api";
import type { HomeSummary } from "@/lib/domain";
import { useApp } from "./provider";
import { copyFor } from "@/lib/i18n";

function HomeSkeleton() {
  return (
    <section className="sc-home-skeleton" aria-busy="true" aria-label="Opening your home">
      <span className="sc-skeleton sc-skeleton-kicker" />
      <span className="sc-skeleton sc-skeleton-title" />
      <div className="sc-skeleton sc-skeleton-card" />
      <div className="sc-skeleton-row">
        <span className="sc-skeleton sc-skeleton-dot" />
        <span className="sc-skeleton sc-skeleton-dot" />
        <span className="sc-skeleton sc-skeleton-dot" />
      </div>
      <div className="sc-skeleton sc-skeleton-line" />
      <div className="sc-skeleton sc-skeleton-line sc-skeleton-short" />
    </section>
  );
}

function CoachMarks({
  userId,
  copy,
}: {
  userId: string;
  copy: ReturnType<typeof copyFor>;
}) {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(`smriti-onboarded:${userId}`)) return;
      if (localStorage.getItem(`smriti-coach:${userId}`)) return;
      setStep(0);
    } catch {
      // Private browsing can block storage. The dashboard still works.
    }
  }, [userId]);

  function finish() {
    try {
      localStorage.setItem(`smriti-coach:${userId}`, "done");
    } catch {
      // The tip can be dismissed for this visit even if storage is blocked.
    }
    setStep(null);
  }

  if (step === null) return null;
  const mark = copy.home.coach[step];
  return (
    <aside className="sc-coach" role="dialog" aria-label="Getting started tips">
      <div className="sc-coach-top">
        <span>
          {copy.nav.home === "Home"
            ? `Tip ${step + 1} of ${copy.home.coach.length}`
            : `सुझाव ${step + 1} / ${copy.home.coach.length}`}
        </span>
        <button type="button" aria-label="Dismiss tip" onClick={finish}>
          <X size={16} />
        </button>
      </div>
      <strong>{mark.title}</strong>
      <p>{mark.body}</p>
      <div className="sc-coach-actions">
        <button type="button" onClick={finish}>
          {copy.nav.home === "Home" ? "Skip tips" : "सुझाव छोड़ें"}
        </button>
        <button
          type="button"
          className="sc-coach-next"
          onClick={() => (step === copy.home.coach.length - 1 ? finish() : setStep(step + 1))}
        >
          {step === copy.home.coach.length - 1
            ? copy.common.done
            : copy.nav.home === "Home"
              ? "Next tip"
              : "अगला सुझाव"}
          <ChevronRight size={15} />
        </button>
      </div>
    </aside>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span className="sc-family-avatar" aria-hidden="true">
      {name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </span>
  );
}

function NextStep({
  home,
  onStart,
  onShowHint,
  copy,
}: {
  home: HomeSummary;
  onStart: (text: string) => void;
  onShowHint: () => void;
  copy: ReturnType<typeof copyFor>;
}) {
  const action = home.next_action;
  const translated =
    copy.home.nextActions[action.kind as keyof typeof copy.home.nextActions];
  const label = action.kind === "weekly_question" ? action.label : translated?.label ?? action.label;
  const detail = translated?.detail ?? action.detail;
  const cta = translated?.cta ?? action.cta;
  return (
    <article className={`sc-next sc-next-${action.kind}`} aria-label="Your next step">
      <span className="sc-next-eyebrow">
        <Sparkles size={13} /> {copy.home.next}
      </span>
      <h2>{label}</h2>
      <p>{detail}</p>
      {action.kind === "hint" ? (
        <button type="button" className="sc-next-action" onClick={onShowHint}>
          {cta}
          <ArrowRight size={16} />
        </button>
      ) : action.kind === "weekly_question" ? (
        <button type="button" className="sc-next-action" onClick={() => onStart(action.label)}>
          {cta}
          <ArrowRight size={16} />
        </button>
      ) : (
        <Link className="sc-next-action" href={action.href}>
          {cta}
          <ArrowRight size={16} />
        </Link>
      )}
    </article>
  );
}

export function HomeDashboard({
  onStart,
  onShowHint,
}: {
  onStart: (text: string) => void;
  onShowHint: () => void;
}) {
  const { user, families } = useApp();
  const copy = copyFor(user.locale);
  const home = useQuery({
    queryKey: ["home"],
    queryFn: () => request<HomeSummary>("/v1/home"),
    staleTime: 0,
  });
  const peopleHref = families.length ? "/app/people" : "/onboarding";

  if (home.isPending) return <HomeSkeleton />;
  if (home.isError) {
    return (
      <section className="sc-home-error" role="alert">
        <span className="sc-home-error-mark">
          <RefreshCw size={22} />
        </span>
        <h1>{copy.nav.home === "Home" ? "We couldn’t open your home" : "आपका घर नहीं खुल सका"}</h1>
        <p>{home.error.message}</p>
        <button type="button" disabled={home.isFetching} onClick={() => void home.refetch()}>
          {home.isFetching ? copy.common.trying : copy.common.retry}
        </button>
      </section>
    );
  }

  const data = home.data;
  const pending = data.pending;
  const pendingTotal = pending.memory_suggestions + pending.hints + pending.share_invites;
  const checklist = data.checklist;
  const checklistComplete = checklist.every((item) => item.done);

  return (
    <section className="sc-home" aria-label="Home dashboard">
      <header className="sc-home-head">
        <span className="sc-home-eyebrow">{copy.home.eyebrow}</span>
        <h1>{copy.home.greeting.replace("{name}", data.greeting_name)}</h1>
        <p>{copy.home.prompt}</p>
      </header>

      <CoachMarks userId={user.id} copy={copy} />

      <NextStep home={data} onStart={onStart} onShowHint={onShowHint} copy={copy} />

      <section className="sc-home-section" aria-label="Your family">
        <div className="sc-home-section-head">
          <h2>{copy.home.family}</h2>
          <Link href={peopleHref}>
            <UserPlus size={15} /> {copy.common.add}
          </Link>
        </div>
        {data.family.length ? (
          <ul className="sc-family-strip">
            {data.family.map((person) => (
              <li key={person.person_id}>
                <Link href="/app/family?view=people">
                  <Initials name={person.name} />
                  <span>{person.name.split(/\s+/)[0]}</span>
                  <small>{person.relation_label}</small>
                </Link>
              </li>
            ))}
            <li>
              <Link className="sc-family-add" href={peopleHref}>
                <span className="sc-family-avatar">
                  <UserPlus size={18} />
                </span>
                <span>{copy.common.add}</span>
                <small>{copy.home.addSomeone}</small>
              </Link>
            </li>
          </ul>
        ) : (
          <div className="sc-home-empty">
            <Users size={21} />
            <p>{copy.home.emptyFamily}</p>
            <Link href={peopleHref}>{copy.home.addSomeoneLove}</Link>
          </div>
        )}
      </section>

      {pendingTotal > 0 && (
        <section className="sc-pending" aria-label="Waiting for you">
          <div className="sc-pending-label">
            <span className="sc-pending-dot" />
            {copy.home.waiting}
          </div>
          <div className="sc-pending-links">
            {pending.memory_suggestions > 0 && (
              <Link href="/app/memory?tab=suggested">
                {pending.memory_suggestions}{" "}
                {pending.memory_suggestions === 1
                  ? copy.home.suggestions
                  : copy.home.suggestionsPlural}
                <ChevronRight size={14} />
              </Link>
            )}
            {pending.hints > 0 && (
              <button type="button" onClick={onShowHint}>
                {pending.hints}{" "}
                {pending.hints === 1 ? copy.home.ideas : copy.home.ideasPlural}
                <ChevronRight size={14} />
              </button>
            )}
            {pending.share_invites > 0 && (
              <Link href="/app/family?view=people">
                {pending.share_invites}{" "}
                {pending.share_invites === 1
                  ? copy.home.invitations
                  : copy.home.invitationsPlural}
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </section>
      )}

      {!checklistComplete && (
        <section className="sc-home-section sc-checklist" aria-label="Getting started">
          <div className="sc-home-section-head">
            <h2>{copy.home.gettingStarted}</h2>
            <span>
              {checklist.filter((item) => item.done).length} of {checklist.length}
            </span>
          </div>
          <ol>
            {checklist.map((item) => (
              <li key={item.key} className={item.done ? "sc-check-done" : ""}>
                <span className="sc-check-mark" aria-hidden="true">
                  {item.done ? <Check size={14} /> : null}
                </span>
                <span>{item.label}</span>
                {item.done ? (
                  <small>{copy.home.done}</small>
                ) : (
                  <Link href={item.href}>
                    {copy.home.doThis}
                    <ChevronRight size={14} />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="sc-home-section" aria-label="Recent stories">
        <div className="sc-home-section-head">
          <h2>{copy.home.recent}</h2>
          {data.recent_stories.length > 0 && (
            <Link href="/app/stories">
              <BookOpen size={15} /> {copy.home.allStories}
            </Link>
          )}
        </div>
        {data.recent_stories.length ? (
          <ul className="sc-recent-stories">
            {data.recent_stories.map((story) => (
              <li key={story.id}>
                <Link href={story.href}>
                  <span>
                    <strong>{story.subject_name ?? story.owner_name ?? "A family story"}</strong>
                    <span>{story.summary}</span>
                  </span>
                  <ChevronRight size={15} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="sc-home-empty">
            <Mic size={21} />
            <p>{copy.home.firstStory}</p>
            <button type="button" onClick={() => onStart("I’d like to tell you a story about ")}>
              {copy.home.tellStory}
            </button>
          </div>
        )}
      </section>

      <section className="sc-home-starters" aria-label="Conversation starters">
        <p>{copy.home.starterLead}</p>
        <div className="sc-starters">
          {copy.home.starters.map((text) => (
            <button key={text} type="button" onClick={() => onStart(text)}>
              {text}
              <span>↗</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
