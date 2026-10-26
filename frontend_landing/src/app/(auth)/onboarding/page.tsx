"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { request, me } from "@/lib/api";
import type { Family, Space } from "@/lib/domain";
import { Button, Logo } from "@/components/ui";
import { copyFor } from "@/lib/i18n";

type PersonDraft = { name: string; relation: string };

const relations = ["Founder", "Engineering", "Finance", "Operations", "Other"];

function markOnboarded(userId: string) {
  try {
    localStorage.setItem(`cloudledger-onboarded:${userId}`, "done");
  } catch {
    // Onboarding still completes when storage is unavailable.
  }
}

function Progress({ step }: { step: number }) {
  return (
    <div className="onboarding-progress" aria-label={`Step ${step + 1} of 3`}>
      <div className="progress-steps" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <i key={index} className={index <= step ? "done" : ""} />
        ))}
      </div>
      <span>Step {step + 1} of 3</span>
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [locale, setLocale] = useState<"en" | "hi">("en");
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyName, setFamilyName] = useState("");
  const [people, setPeople] = useState<PersonDraft[]>([{ name: "", relation: "Engineering" }]);
  const [visiblePeople, setVisiblePeople] = useState(1);
  const [firstMessage, setFirstMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = copyFor(locale);

  async function changeLocale(next: "en" | "hi") {
    setLocale(next);
    try {
      await request("/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ locale: next }),
      });
    } catch {
      // The choice still applies to this visit and is retried on Continue.
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const account = await me();
      if (!account) {
        router.replace("/login");
        return;
      }
      setUserId(account.id);
      setName(account.name);
      setLocale(account.locale === "hi" ? "hi" : "en");
      setFamilies(await request<Family[]>("/v1/families"));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "We couldn’t open your account.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function finish() {
    if (userId) markOnboarded(userId);
    router.replace("/app");
    router.refresh();
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Please add the name you’d like us to use.");
      return;
    }
    setBusy(true);
    try {
      await request("/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), locale }),
      });
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t save your name.");
    } finally {
      setBusy(false);
    }
  }

  async function savePeople(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const named = people.filter((person) => person.name.trim());
    if (!families.length && !familyName.trim() && !named.length) {
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      let family = families[0];
      if (!family) {
        family = await request<Family>("/v1/families", {
          method: "POST",
          body: JSON.stringify({
            name: familyName.trim() || `${name.trim().split(/\s+/)[0] || "My"} workspace`,
          }),
        });
        setFamilies([family]);
      }
      for (const [index, person] of people.entries()) {
        const displayName = person.name.trim();
        if (!displayName) continue;
        await request(`/v1/families/${family.id}/people-with-relation`, {
          method: "POST",
          body: JSON.stringify({
            display_name: displayName,
            relation: person.relation,
          }),
        });
        // Clear each success so a retry only sends the people still missing.
        setPeople((current) =>
          current.map((draft, position) => (position === index ? { ...draft, name: "" } : draft)),
        );
      }
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t add your team yet.");
    } finally {
      setBusy(false);
    }
  }

  function setPerson(index: number, patch: Partial<PersonDraft>) {
    setPeople((current) =>
      current.map((person, position) => (position === index ? { ...person, ...patch } : person)),
    );
  }

  async function sendFirst(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    const message = firstMessage.trim();
    if (!message) return;
    setBusy(true);
    try {
      const spaces = await request<Space[]>("/v1/spaces");
      const personal = spaces.find((space) => space.type === "personal");
      if (!personal) throw new Error("Your personal space is still opening. Please try again.");
      const turn = await request<{ conversation_id: string }>(`/v1/spaces/${personal.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      markOnboarded(userId);
      router.replace(`/app?chat=${turn.conversation_id}`);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "CloudLedger couldn’t reply yet. Your message is still here — try again or begin later.",
      );
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main id="main" className="auth-page onboarding-page" aria-busy="true">
        <aside className="auth-aside">
          <Logo />
        </aside>
        <div className="auth-main">
          <div className="onboarding-skeleton" aria-label="Opening your workspace">
            <span className="sc-skeleton sc-skeleton-kicker" />
            <span className="sc-skeleton sc-skeleton-title" />
            <span className="sc-skeleton sc-skeleton-line" />
            <span className="sc-skeleton sc-skeleton-input" />
            <span className="sc-skeleton sc-skeleton-input" />
            <span className="sc-skeleton sc-skeleton-card" />
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main id="main" className="auth-page onboarding-page">
        <aside className="auth-aside">
          <Logo />
        </aside>
        <div className="auth-main">
          <div className="auth-card" role="alert">
            <span className="eyebrow">One moment</span>
            <h1>We couldn’t open your workspace</h1>
            <p>{loadError}</p>
            <Button onClick={() => void load()}>Retry</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="auth-page onboarding-page">
      <aside className="auth-aside">
        <Logo />
        <div>
          <span className="eyebrow">A clearer view of cloud spend</span>
          <h2>
            A clearer view,
            <br />
            from the first scan.
          </h2>
          <p>Three small steps. You can skip any of them and return whenever you like.</p>
        </div>
        <p>Private by default. Shared only by you.</p>
      </aside>
      <div className="auth-main">
        <div className="auth-card onboarding-card">
          <div className="onboarding-topline">
            <Progress step={step} />
            <div className="language-toggle" role="group" aria-label={copy.onboarding.language}>
              <button
                type="button"
                aria-pressed={locale === "en"}
                onClick={() => void changeLocale("en")}
              >
                EN
              </button>
              <button
                type="button"
                aria-pressed={locale === "hi"}
                onClick={() => void changeLocale("hi")}
                lang="hi"
              >
                हिं
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}

          {step === 0 && (
            <>
              <span className="eyebrow">Let’s begin</span>
              <h1>{copy.onboarding.nameTitle}</h1>
              <p>{copy.onboarding.nameBody}</p>
              <form className="stack" onSubmit={saveName}>
                <label className="field">
                  {copy.onboarding.nameLabel}
                  <input
                    required
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                  />
                </label>
                <fieldset className="onboarding-chips">
                  <legend>{copy.onboarding.language}</legend>
                  <button
                    type="button"
                    aria-pressed={locale === "en"}
                    onClick={() => void changeLocale("en")}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    aria-pressed={locale === "hi"}
                    onClick={() => void changeLocale("hi")}
                  >
                    हिंदी · Hindi
                  </button>
                </fieldset>
                <Button disabled={busy}>
                  {busy ? copy.onboarding.saving : copy.common.continue}
                </Button>
                <button type="button" className="onboarding-skip" onClick={finish}>
                  {copy.onboarding.saveLater}
                </button>
              </form>
            </>
          )}

          {step === 1 && (
            <>
              <span className="eyebrow">Your team</span>
              <h1>{copy.onboarding.peopleTitle}</h1>
              <p>{copy.onboarding.peopleBody}</p>
              <form className="stack" onSubmit={savePeople}>
                {!families.length && (
                  <label className="field">
                    {copy.onboarding.familyName}
                    <input
                      maxLength={120}
                      value={familyName}
                      onChange={(event) => setFamilyName(event.target.value)}
                      placeholder="Your company name"
                    />
                  </label>
                )}
                {people.slice(0, visiblePeople).map((person, index) => (
                  <fieldset className="onboarding-person" key={index}>
                    <legend>
                      {index === 0
                        ? copy.onboarding.firstPerson
                        : copy.onboarding.secondPerson}{" "}
                      ({copy.onboarding.optional})
                    </legend>
                    <label className="field">
                      {index === 0
                        ? copy.onboarding.firstPersonName
                        : copy.onboarding.secondPersonName}
                      <input
                        maxLength={120}
                        value={person.name}
                        onChange={(event) => setPerson(index, { name: event.target.value })}
                        placeholder="Teammate’s name"
                      />
                    </label>
                    <div
                      className="onboarding-chips"
                      role="group"
                      aria-label={`${index === 0 ? "First" : "Second"} teammate’s role`}
                    >
                      {relations.map((relation) => (
                        <button
                          key={relation}
                          type="button"
                          aria-pressed={person.relation === relation}
                          onClick={() => setPerson(index, { relation })}
                        >
                          {relation}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
                {visiblePeople < 2 && (
                  <button
                    type="button"
                    className="onboarding-add"
                    onClick={() => {
                      setPeople((current) =>
                        current.length < 2
                          ? [...current, { name: "", relation: "Engineering" }]
                          : current,
                      );
                      setVisiblePeople(2);
                    }}
                  >
                    {copy.onboarding.addSecond}
                  </button>
                )}
                <Button disabled={busy}>
                  {busy ? copy.onboarding.adding : copy.common.continue}
                </Button>
                <div className="onboarding-row">
                  <button type="button" className="onboarding-skip" onClick={() => setStep(0)}>
                    {copy.onboarding.back}
                  </button>
                  <button type="button" className="onboarding-skip" onClick={() => setStep(2)}>
                    {copy.onboarding.skipForNow}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <span className="eyebrow">Your first question</span>
              <h1>{copy.onboarding.firstChatTitle}</h1>
              <p>{copy.onboarding.firstChatBody}</p>
              <form className="stack" onSubmit={sendFirst}>
                <label className="field">
                  {copy.onboarding.firstChatLabel}
                  <textarea
                    rows={3}
                    maxLength={8000}
                    value={firstMessage}
                    onChange={(event) => setFirstMessage(event.target.value)}
                    placeholder={copy.onboarding.firstChatPlaceholder}
                  />
                </label>
                <Button disabled={busy || !firstMessage.trim()}>
                  {busy ? copy.onboarding.sending : copy.onboarding.sendFirst}
                </Button>
                {error && (
                  <button
                    type="button"
                    className="onboarding-retry"
                    onClick={() => void sendFirst()}
                  >
                    {copy.common.retry}
                  </button>
                )}
              </form>
              <div className="onboarding-row">
                <button type="button" className="onboarding-skip" onClick={() => setStep(1)}>
                  {copy.onboarding.back}
                </button>
                <button type="button" className="onboarding-skip" onClick={finish}>
                  {copy.onboarding.later}
                </button>
              </div>
            </>
          )}

          <p className="onboarding-privacy">
            <Link href="/legal/privacy">{copy.onboarding.privacy}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
