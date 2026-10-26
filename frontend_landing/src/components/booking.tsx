"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Clock, Video, ShieldCheck, ArrowRight, Download } from "lucide-react";
import { Button, EmptyState } from "./ui";
import { downloadBlob } from "@/lib/workspace";

type Draft = {
  duration: number;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  relationship: string;
  city: string;
  note: string;
  session?: string;
};
const KEY = "cloudledger-booking-draft";
const initial: Draft = {
  duration: 15,
  date: "",
  time: "",
  name: "",
  email: "",
  phone: "",
  relationship: "",
  city: "",
  note: "",
};
const times = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];

function nextDays() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(`${today}T12:00:00+05:30`);
    d.setUTCDate(d.getUTCDate() + i + 1);
    return {
      value: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Kolkata" }),
      number: d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Asia/Kolkata" }),
    };
  });
}

export function BookingFlow({ session }: { session?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    ...initial,
    duration: params.get("type") === "story" ? 30 : 15,
    session,
  });
  const [days, setDays] = useState<ReturnType<typeof nextDays>>([]);
  const [error, setError] = useState("");
  const calUrl = process.env.NEXT_PUBLIC_CAL_URL;
  useEffect(() => {
    setDays(nextDays());
    try {
      if (params.get("reschedule")) {
        const saved = sessionStorage.getItem(KEY);
        if (saved) setDraft(JSON.parse(saved));
      }
    } catch {
      /* A new draft can still be created. */
    }
  }, [params]);
  const field = (key: keyof Draft, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  function next(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 0 && (!draft.date || !draft.time)) {
      setError("Choose a date and time to continue.");
      return;
    }
    if (step === 1 && !/^[+\d\s()-]{8,18}$/.test(draft.phone)) {
      setError("Enter a valid contact number, including your country code.");
      return;
    }
    setError("");
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    try {
      sessionStorage.setItem(KEY, JSON.stringify(draft));
      router.push("/book/confirmed");
    } catch {
      setError("Your draft could not be saved. Enable site storage and retry.");
    }
  }

  return (
    <div className="booking-layout">
      <aside className="booking-aside">
        <span className="tag">A CLOUDLEDGER INTRO</span>
        <h2>{session || "Start with one cloud account."}</h2>
        <p>
          A short introduction, or a longer session to walk through a cost audit. Your choice.
        </p>
        <div className="booking-meta">
          <Clock size={16} />
          {draft.duration} minutes
        </div>
        <div className="booking-meta">
          <Video size={16} />
          Video conversation
        </div>
        <div className="booking-meta">
          <CalendarDays size={16} />
          India Standard Time · UTC+05:30
        </div>
        <div className="booking-meta">
          <ShieldCheck size={16} />
          No payment required
        </div>
        <div className="notice" style={{ marginTop: 25 }}>
          {calUrl
            ? "Use our connected calendar to check live availability and confirm an appointment."
            : "Scheduling is not connected yet. You can prepare a booking draft below. These are example times, not live availability."}
        </div>
        {calUrl && (
          <a href={calUrl} className="button button-dark" style={{ marginTop: 16 }}>
            Open the live booking calendar <ArrowRight size={14} />
          </a>
        )}
      </aside>
      <form className="panel stack" onSubmit={next}>
        <div className="progress-steps">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i <= step ? "done" : ""} />
          ))}
        </div>
        <h3>
          {["Choose your conversation", "A little about you", "Review your booking draft"][step]}
        </h3>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {step === 0 && (
          <>
            <div className="choice-grid">
              {[15, 30].map((duration) => (
                <button
                  key={duration}
                  type="button"
                  className="choice"
                  aria-pressed={draft.duration === duration}
                  onClick={() => setDraft({ ...draft, duration })}
                >
                  {duration} minutes
                  <small>
                    {duration === 15 ? "A friendly introduction" : "Walk through an audit"}
                  </small>
                </button>
              ))}
            </div>
            <span className="small-label">Next 14 days · IST</span>
            <div className="date-grid">
              {days.map((day) => (
                <button
                  type="button"
                  key={day.value}
                  aria-label={day.value}
                  aria-pressed={draft.date === day.value}
                  onClick={() => setDraft({ ...draft, date: day.value, time: "" })}
                >
                  <small>{day.day}</small>
                  {day.number}
                </button>
              ))}
            </div>
            {draft.date && (
              <>
                <span className="small-label">Example time slots · IST</span>
                <div className="slot-grid">
                  {times.map((time) => (
                    <button
                      key={time}
                      type="button"
                      aria-pressed={draft.time === time}
                      onClick={() => setDraft({ ...draft, time })}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <div className="field-row">
              <label className="field">
                Full name
                <input
                  required
                  maxLength={80}
                  autoComplete="name"
                  value={draft.name}
                  onChange={(e) => field("name", e.target.value)}
                />
              </label>
              <label className="field">
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={(e) => field("email", e.target.value)}
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                WhatsApp / phone
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91"
                  value={draft.phone}
                  onChange={(e) => field("phone", e.target.value)}
                />
              </label>
              <label className="field">
                City
                <input
                  required
                  maxLength={80}
                  autoComplete="address-level2"
                  value={draft.city}
                  onChange={(e) => field("city", e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              Your role
              <select
                required
                value={draft.relationship}
                onChange={(e) => field("relationship", e.target.value)}
              >
                <option value="">Choose a role</option>
                {["Founder", "Engineering", "Finance", "Procurement", "Other"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Anything you’d like us to know? (optional)
              <textarea
                maxLength={2000}
                value={draft.note}
                onChange={(e) => field("note", e.target.value)}
              />
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <div className="stack">
              <p>
                <strong>{draft.name}</strong>
                <br />
                {draft.email}
                <br />
                {draft.phone}
              </p>
              <p>
                {draft.duration}-minute conversation
                <br />
                {draft.date} at {draft.time} IST
                <br />
                {draft.city} · {draft.relationship}
              </p>
              {draft.note && <p>{draft.note}</p>}
            </div>
            <div className="notice">
              Saving this draft will not reserve a slot or send a confirmation. You can download a
              tentative calendar reminder on the next screen.
            </div>
          </>
        )}
        <div className="button-row">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button type="submit">
            {step === 2 ? "Save my booking draft" : "Continue"}
            <ArrowRight size={14} />
          </Button>
        </div>
      </form>
    </div>
  );
}

export function BookingConfirmation() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    try {
      const value = sessionStorage.getItem(KEY);
      if (value) setDraft(JSON.parse(value));
    } catch {
      setError("Your booking draft could not be read.");
    }
    setReady(true);
  }, []);

  function calendar() {
    if (!draft) return;
    try {
      const start = new Date(`${draft.date}T${draft.time}:00+05:30`);
      const stamp = (date: Date) =>
        date
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "");
      const content = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CloudLedger//Booking Draft//EN",
        "BEGIN:VEVENT",
        `UID:${start.getTime()}-draft@cloudledger.example`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(new Date(start.getTime() + draft.duration * 60000))}`,
        "SUMMARY:CloudLedger intro - tentative draft",
        "STATUS:TENTATIVE",
        "DESCRIPTION:This is a local reminder only. No appointment has been confirmed.",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
      downloadBlob(
        new Blob([content], { type: "text/calendar" }),
        "cloudledger-tentative-intro.ics",
      );
    } catch {
      setError("This draft has an invalid date. Choose a new date before downloading.");
    }
  }
  if (!ready) return <div className="skeleton" />;
  if (!draft)
    return (
      <EmptyState
        title="No booking draft yet."
        description={error || "Choose a time and tell us a little about your setup to begin."}
      >
        <Button href="/book">Book a time</Button>
      </EmptyState>
    );
  return (
    <div className="panel stack">
      <span className="tag">DRAFT SAVED · NOT A CONFIRMED BOOKING</span>
      <h2 style={{ fontSize: 30 }}>Your intro call is drafted.</h2>
      <p>
        {draft.name}, your {draft.duration}-minute conversation draft is saved for{" "}
        <strong>
          {draft.date} at {draft.time} IST
        </strong>
        .
      </p>
      <div className="notice">
        No slot has been reserved and no email or WhatsApp message has been sent. Connect a
        scheduling service to make a real appointment.
      </div>
      {error && <p className="error-message">{error}</p>}
      <div className="button-row">
        <Button onClick={calendar}>
          <Download size={15} /> Tentative calendar reminder
        </Button>
        <Button href="/book?reschedule=1" variant="outline">
          Edit draft
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (confirm("Delete this booking draft?")) {
              sessionStorage.removeItem(KEY);
              router.push("/book");
            }
          }}
        >
          Delete draft
        </Button>
      </div>
    </div>
  );
}
