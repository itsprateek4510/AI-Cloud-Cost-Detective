"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import type { MemorySettings } from "@/lib/domain";
import { useApp } from "./provider";
import { Heading, ErrorState } from "./common";
import { Activity, Prompts } from "./engagement";
import { copyFor } from "@/lib/i18n";

function SettingsTabs({ current }: { current: "preferences" | "questions" | "activity" }) {
  const { user } = useApp();
  const copy = copyFor(user.locale);
  const tabs = [
    { key: "preferences", label: copy.settings.preferences, href: "/app/settings" },
    { key: "questions", label: copy.settings.questions, href: "/app/settings?view=questions" },
    { key: "activity", label: copy.settings.activity, href: "/app/settings?view=activity" },
  ] as const;
  return (
    <nav className="hub-tabs" aria-label="Settings sections">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function Settings() {
  const client = useQueryClient();
  const { user } = useApp();
  const copy = copyFor(user.locale);
  const params = useSearchParams();
  const view = params.get("view");
  const [notice, setNotice] = useState("");
  const [large, setLarge] = useState(false);
  const settings = useQuery({
    queryKey: ["memory-settings"],
    queryFn: () => request<MemorySettings>("/v1/settings/memory"),
  });
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () =>
      request<{ openai_configured: boolean; llm_model: string; embedding_model: string }>(
        "/v1/settings/integrations",
      ),
  });
  const consents = useQuery({
    queryKey: ["consents"],
    queryFn: () =>
      request<{ id: string; recording_id: string; revoked_at: string | null; given_at: string }[]>(
        "/v1/consents",
      ),
  });
  const save = useMutation({
    mutationFn: (body: MemorySettings) =>
      request("/v1/settings/memory", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      setNotice("Preferences saved.");
      void client.invalidateQueries({ queryKey: ["memory-settings"] });
    },
  });
  const advanced = useMutation({
    mutationFn: (enabled: boolean) =>
      request<{ advanced_mode: boolean }>("/v1/me/advanced-mode", {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: (data) => {
      setNotice(data.advanced_mode ? "Advanced tools are on." : "Advanced tools are off.");
      void client.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const action = useMutation({
    mutationFn: ({ path, method = "POST" }: { path: string; method?: string }) =>
      request<{ scheduled_at?: string }>(path, { method }),
    onSuccess: (data) => {
      setNotice(
        data.scheduled_at
          ? `Account deletion scheduled for ${new Date(data.scheduled_at).toLocaleDateString()}. You may cancel during the 30-day cooling-off period.`
          : "Updated.",
      );
      void client.invalidateQueries();
    },
  });
  const download = useMutation({
    mutationFn: () => request<unknown>("/v1/export", { method: "POST" }),
    onSuccess: (data) => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "smriti-export.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Your data export is ready. Download original audio from each recording.");
    },
  });
  if (view === "questions" || view === "activity") {
    return (
      <div className={large ? "eco-large-text" : ""}>
        <SettingsTabs current={view} />
        {view === "questions" ? <Prompts /> : <Activity />}
      </div>
    );
  }
  return (
    <div className={large ? "eco-large-text" : ""}>
      <SettingsTabs current="preferences" />
      <Heading
        eyebrow="Your archive, your choices"
        title={copy.settings.title}
        description={copy.settings.description}
      />
      {settings.data && (
        <section className="eco-card">
          <h2>What your AI remembers</h2>
          <p>
            Remembering is off until you choose it. Suggested memories always need your
            confirmation.
          </p>
          <label className="eco-settings-line">
            <span>Remember things from my personal chats</span>
            <input
              type="checkbox"
              checked={settings.data.remember_chats}
              disabled={save.isPending}
              onChange={(e) => save.mutate({ ...settings.data!, remember_chats: e.target.checked })}
            />
          </label>
          <label className="eco-settings-line">
            <span>Start personal chats in Incognito by default</span>
            <input
              type="checkbox"
              checked={settings.data.incognito_default}
              disabled={save.isPending}
              onChange={(e) =>
                save.mutate({ ...settings.data!, incognito_default: e.target.checked })
              }
            />
          </label>
          <p className="eco-caption">
            Unpinned AI chat memories expire after {settings.data.retention_days} days. Your
            recordings are retained until you delete them.
          </p>
        </section>
      )}
      <section className="eco-card">
        <h2>Gentle family ideas</h2>
        {settings.data && (
          <label>
            Care hints
            <select
              value={settings.data.hints_mode ?? "ask"}
              disabled={save.isPending}
              onChange={(e) =>
                save.mutate({
                  ...settings.data!,
                  hints_mode: e.target.value as MemorySettings["hints_mode"],
                })
              }
            >
              <option value="off">Off</option>
              <option value="ask">Ask me before passing an idea</option>
              <option value="auto_safe">Automatically pass safe ideas</option>
            </select>
          </label>
        )}
        <p>
          Your chat and sources are never shared. Only small, safe ideas go to confirmed family
          connections.
        </p>
      </section>
      <section className="eco-card">
        <h2>Make it comfortable</h2>
        <label className="eco-settings-line">
          <span>Larger text on this screen</span>
          <input type="checkbox" checked={large} onChange={(e) => setLarge(e.target.checked)} />
        </label>
        <p>
          Hindi and other languages can be entered in any text field. The interface is currently in
          English.
        </p>
      </section>
      <section className="eco-card">
        <h2>Advanced tools</h2>
        <p>
          Heritage studio and Groups are optional. The everyday app stays focused on Home, Family,
          Stories, and Settings unless you turn them on.
        </p>
        <label className="eco-settings-line">
          <span>Show advanced tools</span>
          <input
            type="checkbox"
            checked={!!user.advanced_mode}
            disabled={advanced.isPending}
            onChange={(e) => advanced.mutate(e.target.checked)}
          />
        </label>
        {user.feature_heritage === false ? (
          <p>Heritage is turned off for this deployment.</p>
        ) : user.advanced_mode ? (
          <div className="eco-actions">
            <Link className="eco-link-button" href="/app/legacy">
              Open Heritage studio
            </Link>
            <Link className="eco-link-button" href="/app/circles">
              Open Groups
            </Link>
          </div>
        ) : null}
      </section>
      <section className="eco-card">
        <h2>Questions and history</h2>
        <p>Gentle follow-up questions and a clear record of activity live here in Settings.</p>
        <div className="eco-actions">
          <Link className="eco-link-button" href="/app/settings?view=questions">
            Questions for you
          </Link>
          <Link className="eco-link-button" href="/app/settings?view=activity">
            Activity
          </Link>
        </div>
      </section>
      <section className="eco-card">
        <h2>Weekly questions</h2>
        {settings.data && (
          <>
            <label className="eco-settings-line">
              <span>One gentle question each week · opt in</span>
              <input
                type="checkbox"
                checked={settings.data.weekly_prompts}
                disabled={save.isPending}
                onChange={(e) =>
                  save.mutate({ ...settings.data!, weekly_prompts: e.target.checked })
                }
              />
            </label>
            <div className="eco-grid">
              <label className="eco-form">
                Quiet hours start (India time)
                <select
                  value={settings.data.quiet_start}
                  onChange={(e) =>
                    save.mutate({ ...settings.data!, quiet_start: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className="eco-form">
                Quiet hours end
                <select
                  value={settings.data.quiet_end}
                  onChange={(e) =>
                    save.mutate({ ...settings.data!, quiet_end: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="eco-actions">
              <button
                disabled={action.isPending}
                onClick={() => action.mutate({ path: "/v1/prompts/pause" })}
              >
                Pause for a month
              </button>
              <button
                disabled={action.isPending}
                onClick={() => action.mutate({ path: "/v1/prompts/resume" })}
              >
                Resume questions
              </button>
            </div>
            {settings.data.prompts_paused_until && (
              <p>
                Paused until {new Date(settings.data.prompts_paused_until).toLocaleDateString()}.
              </p>
            )}
          </>
        )}
      </section>
      <section className="eco-card">
        <h2>AI connection</h2>
        {integrations.data && (
          <>
            <span className="eco-badge">
              {integrations.data.openai_configured ? "OpenAI connected" : "OpenAI key needed"}
            </span>
            <p>
              {integrations.data.openai_configured
                ? `${integrations.data.llm_model} · ${integrations.data.embedding_model} · Whisper transcription`
                : "Add OPENAI_API_KEY to backend/.env and restart the API and worker to enable transcription, extraction, embeddings, and verified archive answers. Manual memories and sharing already work."}
            </p>
          </>
        )}
      </section>
      <section className="eco-card">
        <h2>Recording consent</h2>
        <p>
          Revoking consent immediately hides a recording and its sourced memories. Files are
          scheduled for deletion after 30 days.
        </p>
        {consents.data?.length ? (
          consents.data.map((c) => (
            <div className="eco-settings-line" key={c.id}>
              <span>
                Recording {c.recording_id.slice(0, 8)} · {new Date(c.given_at).toLocaleDateString()}
                <small style={{ display: "block" }}>
                  {c.revoked_at ? "Revoked" : "Consent recorded"}
                </small>
              </span>
              {!c.revoked_at && (
                <button
                  disabled={action.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Revoke consent for this recording and every memory derived from it?",
                      )
                    )
                      action.mutate({ path: `/v1/consents/${c.id}/revoke` });
                  }}
                >
                  Revoke
                </button>
              )}
            </div>
          ))
        ) : (
          <p>No recording consents yet.</p>
        )}
      </section>
      <section className="eco-card">
        <h2>Take your memories with you</h2>
        <p>Export your profile, memories, sources, conversations, and transcripts as JSON.</p>
        <button disabled={download.isPending} onClick={() => download.mutate()}>
          {download.isPending ? "Preparing…" : "Export my data"}
        </button>
      </section>
      <section className="eco-card eco-danger">
        <h2>Delete your account</h2>
        <p>
          There is a 30-day cooling-off period. After that, your contributed content is withdrawn
          and identifying account data is removed.
        </p>
        <div className="eco-actions">
          <button
            disabled={action.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Schedule deletion of your account and contributed content after 30 days?",
                )
              )
                action.mutate({ path: "/v1/me", method: "DELETE" });
            }}
          >
            Schedule deletion
          </button>
          <button
            disabled={action.isPending}
            onClick={() => action.mutate({ path: "/v1/me/cancel-deletion" })}
          >
            Cancel scheduled deletion
          </button>
        </div>
      </section>
      {notice && (
        <p className="eco-notice" role="status">
          {notice}
        </p>
      )}
      <ErrorState
        error={settings.error || consents.error || save.error || action.error || download.error}
      />
    </div>
  );
}
