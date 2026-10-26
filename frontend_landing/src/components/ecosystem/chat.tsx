"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import type { Thread, Message, Answer, MemorySettings, Citation, Member } from "@/lib/domain";
import { useApp } from "./provider";
import { Heading, Empty, ErrorState } from "./common";
import { VisibilityBadge } from "./shell";
import { RawShare } from "./raw-share";
import { copyFor } from "@/lib/i18n";

export function Chat({ kind }: { kind: "personal" | "family" | "circle" }) {
  const { spaces, space, families, user } = useApp();
  const copy = copyFor(user.locale);
  const client = useQueryClient();
  const available = spaces.filter((s) => s.type === kind);
  const [chosen, setChosen] = useState("");
  const selected =
    available.find((s) => s.id === chosen) ??
    available.find((s) => s.id === space?.id) ??
    available[0];
  const [thread, setThread] = useState("");
  const [body, setBody] = useState("");
  const [incognitoChoice, setIncognito] = useState<boolean | null>(null);
  const [askMode, setAskMode] = useState(kind === "personal" ? "private" : "thread");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [askArchive, setAskArchive] = useState(kind === "personal");
  const [sharedFamily, setSharedFamily] = useState("");
  const [mentioned, setMentioned] = useState<Member[]>([]);
  const members = useQuery({
    queryKey: ["space-members", selected?.id],
    queryFn: () => request<Member[]>(`/v1/spaces/${selected?.id}/members`),
    enabled: !!selected,
  });
  const mentionSearch = body.match(/(?:^|\s)@([^\n]*)$/u)?.[1];
  const suggestions =
    mentionSearch !== undefined
      ? (members.data
          ?.filter(
            (m) =>
              m.id !== user.id &&
              m.name.toLocaleLowerCase().startsWith(mentionSearch.toLocaleLowerCase()),
          )
          .slice(0, 5) ?? [])
      : [];
  const threads = useQuery({
    queryKey: ["threads", selected?.id],
    queryFn: () => request<Thread[]>(`/v1/spaces/${selected?.id}/conversations`),
    enabled: !!selected,
  });
  const current = threads.data?.find((t) => t.id === thread) ?? threads.data?.[0];
  const audience = useQuery({
    queryKey: ["raw-effective", "conversation", current?.id],
    queryFn: () =>
      request<{ user_id: string; name: string; level: string }[]>(
        `/v1/items/conversation/${current?.id}/effective-access`,
      ),
    enabled: !!current && current.owner_user_id === user.id && kind === "personal",
  });
  const sharedNames = audience.data?.filter((p) => p.user_id !== user.id).map((p) => p.name) ?? [];
  const destination =
    kind === "personal"
      ? sharedNames.length
        ? `Shared with ${sharedNames.join(", ")}`
        : "Only you"
      : (selected?.name ?? "Shared space");
  const messages = useQuery({
    queryKey: ["messages", current?.id],
    queryFn: () => request<Message[]>(`/v1/conversations/${current?.id}/messages`),
    enabled: !!current,
    refetchInterval: kind === "personal" ? false : 5000,
  });
  const settings = useQuery({
    queryKey: ["memory-settings"],
    queryFn: () => request<MemorySettings>("/v1/settings/memory"),
  });
  const incognito = incognitoChoice ?? settings.data?.incognito_default ?? false;
  const create = useMutation({
    mutationFn: () =>
      request<Thread>(`/v1/spaces/${selected?.id}/conversations`, {
        method: "POST",
        body: JSON.stringify({
          title: incognito ? "Incognito conversation" : "A new conversation",
          incognito,
        }),
      }),
    onSuccess: (result) => {
      setThread(result.id);
      setAnswer(null);
      void client.invalidateQueries({ queryKey: ["threads"] });
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      if (askArchive)
        return request<Answer>(`/v1/spaces/${selected?.id}/ask`, {
          method: "POST",
          body: JSON.stringify({
            question: body,
            mode: askMode,
            conversation_id: current?.id,
            family_id: sharedFamily || null,
          }),
        });
      let threadId = current?.id;
      if (!threadId) {
        const t = await create.mutateAsync();
        threadId = t.id;
      }
      await request(`/v1/conversations/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body,
          mentioned_user_ids: mentioned.filter((m) => body.includes(`@${m.name}`)).map((m) => m.id),
        }),
      });
      return null;
    },
    onSuccess: (result) => {
      setAnswer(kind === "personal" || askMode === "thread" ? null : result);
      if (result?.conversation_id) {
        setThread(result.conversation_id);
        void client.invalidateQueries({ queryKey: ["threads"] });
      }
      setBody("");
      setMentioned([]);
      void client.invalidateQueries({ queryKey: ["messages"] });
    },
  });
  const extract = useMutation({
    mutationFn: () =>
      request<{ suggested_ids: string[] }>(`/v1/conversations/${current?.id}/extract`, {
        method: "POST",
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["memories"] }),
  });
  if (!selected)
    return (
      <>
        <Heading title={kind === "family" ? copy.family.chatTitle : copy.family.groupsTitle} />
        <Empty
          title={
            kind === "family" ? copy.family.emptyChatTitle : copy.family.groupsDescription
          }
          description={
            kind === "family"
              ? copy.family.emptyChatDescription
              : copy.family.groupsEmptyDescription
          }
        >
          <Link className="eco-primary" href={families.length ? "/app/circles" : "/onboarding"}>
            {families.length ? copy.family.createGroup : copy.family.createFamily}
          </Link>
        </Empty>
      </>
    );
  return (
    <>
      <Heading
        eyebrow={
          kind === "personal"
            ? "A space that’s only yours"
            : copy.family.chatEyebrow
        }
        title={kind === "personal" ? "Me, and my memories" : selected.name}
        description={
          kind === "personal"
            ? "Reflect, keep a story, or ask your archive. Nothing moves to the family on its own."
            : copy.family.chatDescription
        }
      />
      <div className="eco-threadbar">
        <VisibilityBadge
          personal={kind === "personal" && !sharedNames.length}
          label={
            audience.isFetching && current && kind === "personal"
              ? "Checking audience…"
              : destination
          }
        />
        {available.length > 1 && (
          <select
            aria-label="Chat space"
            style={{ width: "auto" }}
            value={selected.id}
            onChange={(e) => {
              setChosen(e.target.value);
              setThread("");
              setAnswer(null);
            }}
          >
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Conversation"
          style={{ width: "auto", maxWidth: 280 }}
          value={current?.id ?? ""}
          onChange={(e) => {
            setThread(e.target.value);
            setAnswer(null);
          }}
        >
          <option value="">Choose conversation</option>
          {threads.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <button onClick={() => create.mutate()} disabled={create.isPending}>
          New conversation
        </button>
        {kind === "personal" && (
          <label className="eco-toggle">
            <input
              type="checkbox"
              checked={incognito}
              onChange={(e) => setIncognito(e.target.checked)}
            />
            Incognito for new conversation
          </label>
        )}
      </div>
      <p className="eco-notice">
        {kind === "personal"
          ? `Remembering chats: ${settings.data?.remember_chats ? "on · suggestions require your review" : "off"}. ${current?.incognito ? "This conversation is Incognito: never written to memory." : "You control what the AI remembers."}`
          : "Using only what everyone here can see for thread answers."}
      </p>
      {current?.owner_user_id === user.id && <RawShare type="conversation" id={current.id} />}
      {kind === "personal" && (
        <label className="eco-switcher">
          Shared archive context (optional, one family at a time)
          <select
            value={sharedFamily}
            onChange={(e) => {
              setSharedFamily(e.target.value);
              setAnswer(null);
            }}
          >
            <option value="">My personal space only</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · only items shared with me
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="eco-chat" style={{ margin: "24px 0" }}>
        {messages.data?.map((m) => (
          <article className={`eco-message ${m.author_user_id ? "" : "eco-ai"}`} key={m.id}>
            <span className="eco-eyebrow">
              {m.author_user_id ? "Family voice" : "Archive answer"}
            </span>
            {m.body}
            <Citations citations={m.citations} />
            {m.author_user_id === user.id && (
              <div className="eco-actions">
                <RawShare type="message" id={m.id} />
              </div>
            )}
          </article>
        ))}
        {!messages.data?.length && (
          <Empty
            title="Start with something small"
            description="Tell a story or ask a question. Use Ask the archive for a sourced answer from confirmed memories."
          />
        )}
      </div>
      {answer && <AnswerCard answer={answer} />}
      <form
        className="eco-card eco-form"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <div className="eco-threadbar">
          <label className="eco-toggle">
            <input
              type="checkbox"
              checked={askArchive}
              onChange={(e) => setAskArchive(e.target.checked)}
            />
            Ask the archive
          </label>
          {askArchive && kind !== "personal" && (
            <select
              aria-label="Answer destination"
              style={{ width: "auto" }}
              value={askMode}
              onChange={(e) => setAskMode(e.target.value)}
            >
              <option value="thread">Ask in thread</option>
              <option value="private">Ask privately</option>
            </select>
          )}
        </div>
        <label>
          {askArchive ? "Your question" : "Your message"}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={askArchive ? 2000 : 20000}
            placeholder={askArchive ? "What did Arun learn about saving?" : "Something I remember…"}
          />
        </label>
        {!askArchive && !!suggestions.length && (
          <div className="eco-actions" aria-label="Mention suggestions">
            {suggestions.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  setBody(body.replace(/@[^@\n]*$/u, `@${member.name} `));
                  setMentioned([...mentioned.filter((m) => m.id !== member.id), member]);
                }}
              >
                @{member.name}
              </button>
            ))}
          </div>
        )}
        <div className="eco-actions">
          <button
            className="eco-primary"
            disabled={
              send.isPending ||
              (askArchive && askMode === "thread" && !current) ||
              (!askArchive && kind === "personal" && !!current && audience.isPending)
            }
          >
            {send.isPending ? "Working…" : askArchive ? "Ask with sources" : "Send message"}
          </button>
          <VisibilityBadge
            personal={
              (kind === "personal" && !sharedNames.length) || (askArchive && askMode === "private")
            }
            label={askArchive && askMode === "private" ? "Only you" : destination}
          />
        </div>
      </form>
      {kind === "personal" && current && settings.data?.remember_chats && !current.incognito && (
        <div className="eco-card">
          <button disabled={extract.isPending} onClick={() => extract.mutate()}>
            {extract.isPending ? "Finding memories…" : "Suggest memories from this chat"}
          </button>
          {extract.isSuccess && (
            <p role="status">
              {extract.data.suggested_ids.length} suggestions ready.{" "}
              <Link href="/app/memory">Review them in Stories Smriti remembers.</Link>
            </p>
          )}
        </div>
      )}
      <ErrorState
        error={
          send.error ||
          messages.error ||
          threads.error ||
          create.error ||
          extract.error ||
          settings.error
        }
      />
    </>
  );
}

export function Citations({ citations }: { citations?: Citation[] }) {
  return citations?.length ? (
    <div className="eco-actions">
      {citations.map((c) => (
        <details key={c.number}>
          <summary className="eco-citation">
            [{c.number}] Source · {c.level}
          </summary>
          <p>{c.summary}</p>
          <Link href={`/app/memory/${c.memory_id}`}>Open memory and permitted sources →</Link>
          <p className="eco-caption">{c.reason.replaceAll("_", " ")}</p>
        </details>
      ))}
    </div>
  ) : null;
}
export function AnswerCard({ answer }: { answer: Answer }) {
  return (
    <article className="eco-card eco-ai" aria-live="polite">
      <span className="eco-eyebrow">
        {answer.verified ? "Verified against recorded sources" : "Your archive"}
      </span>
      <p style={{ whiteSpace: "pre-wrap" }}>{answer.answer}</p>
      <Citations citations={answer.citations} />
      {answer.private_answer_available && (
        <p className="eco-caption">
          You can also choose Ask privately to receive an answer only you will see.
        </p>
      )}
    </article>
  );
}
