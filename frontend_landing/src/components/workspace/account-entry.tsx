"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Logo } from "../ui";
import { login, signup, GOOGLE_LOGIN_URL } from "@/lib/api";

export function AccountEntry({ returning = false }: { returning?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const email = String(fields.get("email"));
      const password = String(fields.get("password"));
      if (returning) await login({ email, password });
      else await signup({ name: String(fields.get("name")), email, password });
      // Remove the previous single-device demo data on every account switch.
      localStorage.removeItem("smriti-workspace-v1");
      const next = params.get("next");
      router.replace(
        next && /^\/app(?:[/?]|$)/.test(next) ? next : returning ? "/app" : "/onboarding",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-page">
      <aside className="auth-aside">
        <Logo />
        <div>
          <span className="eyebrow">A clearer view of cloud spend</span>
          <h2>
            Every line,
            <br />
            accounted for.
          </h2>
          <p>One place for cost findings, the evidence behind them, and the next fix.</p>
        </div>
        <p>Read-only by default. Shared only by you.</p>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">
            {returning ? "Welcome back" : "Start with one account"}
          </span>
          <h1>{returning ? "Your workspace is here." : "See where your spend goes."}</h1>
          {(error || params.get("error")) && (
            <p role="alert" className="notice">
              {error ||
                (params.get("error") === "google_not_configured"
                  ? "Google sign-in is not configured yet. You can sign in with email."
                  : "Google sign-in could not be completed. Please try again.")}
            </p>
          )}
          <form className="stack" onSubmit={submit}>
            {!returning && (
              <label className="field">
                Your name
                <input name="name" required maxLength={80} autoComplete="name" />
              </label>
            )}
            <label className="field">
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label className="field">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={returning ? 1 : 8}
                maxLength={128}
                autoComplete={returning ? "current-password" : "new-password"}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Please wait…" : returning ? "Sign in" : "Create account"}
            </Button>
          </form>
          <a
            href={GOOGLE_LOGIN_URL}
            className="button button-outline"
            style={{ marginTop: 16, width: "100%" }}
          >
            Continue with Google
          </a>
          <div className="auth-bottom">
            <Link
              href={
                (returning ? "/signup" : "/login") +
                (params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : "")
              }
            >
              {returning ? "Create an account" : "Already have an account? Sign in"}
            </Link>{" "}
            · <Link href="/">Back to CloudLedger</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
