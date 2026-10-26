"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { API_URL, ApiError, logout, request } from "@/lib/api";
import type { Memory, MemorySettings, Message, Thread } from "@/lib/domain";
import { Logo } from "../ui";
import { HelpLink } from "../docs/help-link";
import { useApp } from "./provider";
import { Modal } from "./common";
import { CareHints } from "./care-hints";
import { RememberCard } from "./chat-remember";
import { HomeDashboard } from "./home-dashboard";
import { AppNavigation, MobileTabBar } from "./navigation";
import { LanguageToggle } from "./language-toggle";
import { copyFor } from "@/lib/i18n";

type Turn = {
  conversation_id: string;
  user_message: Message;
  assistant_message: Message;
  suggested_memory_ids: string[];
};

export function ChatWorkspace() {
  const { user, spaces } = useApp();
  const copy = copyFor(user.locale);
  const router = useRouter();
  const params = useSearchParams();
  const cache = useQueryClient();
  const space = spaces.find((s) => s.type === "personal");
  const conversation = params.get("chat");
  const notice = params.get("notice");
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [draft, setDraft] = useState("");
  const [mobile, setMobile] = useState(false);
  const [panel, setPanel] = useState<"saved" | "suggested" | null>(null);
  const [connection, setConnection] = useState(false);
  const [incognitoChoice, setIncognito] = useState<boolean | null>(null);
  const [turnSuggestions, setTurnSuggestions] = useState<Record<string, string[]>>({});
  const [streamed, setStreamed] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const threads = useQuery({
    queryKey: ["threads", space?.id],
    queryFn: () => request<Thread[]>(`/v1/spaces/${space?.id}/conversations`),
    enabled: !!space,
  });
  const messages = useQuery({
    queryKey: ["messages", conversation],
    queryFn: () => request<Message[]>(`/v1/conversations/${conversation}/messages`),
    enabled: !!conversation,
  });
  const preferences = useQuery({
    queryKey: ["memory-settings"],
    queryFn: () => request<MemorySettings>("/v1/settings/memory"),
  });
  const integration = useQuery({
    queryKey: ["integrations"],
    queryFn: () =>
      request<{ ai_configured?: boolean; openai_configured: boolean }>("/v1/settings/integrations"),
  });
  const saved = useQuery({
    queryKey: ["memories", space?.id, "chat-saved"],
    queryFn: () => request<Memory[]>(`/v1/memories?tab=confirmed&space_id=${space?.id}`),
    enabled: !!space,
  });
  const suggested = useQuery({
    queryKey: ["memories", space?.id, "chat-suggested"],
    queryFn: () => request<Memory[]>(`/v1/memories?tab=suggested&space_id=${space?.id}`),
    enabled: !!space,
  });
  const selectedThread = threads.data?.find((t) => t.id === conversation);
  const incognito = incognitoChoice ?? preferences.data?.incognito_default ?? false;
  const memoryOn = preferences.data?.remember_chats ?? false;
  const isIncognito = selectedThread?.incognito ?? incognito;

  const remember = useMutation({
    mutationFn: () =>
      request("/v1/settings/memory", {
        method: "PUT",
        body: JSON.stringify({ ...preferences.data, remember_chats: !memoryOn }),
      }),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ["memory-settings"] }),
  });
  const send = useMutation<Turn, Error, { message: string; ownerId: string }>({
    mutationFn: async ({ message }) => {
      setStreamed("");
      const response = await fetch(`${API_URL}/v1/spaces/${space?.id}/chat/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversation_id: conversation,
          incognito: conversation ? undefined : incognito,
        }),
      });
      if (!response.ok) {
        let detail: unknown = null;
        try {
          detail = await response.json();
        } catch {
          detail = null;
        }
        const payload =
          detail && typeof detail === "object" && "detail" in detail
            ? (detail as { detail: unknown }).detail
            : null;
        const messageText =
          payload && typeof payload === "object" && "message" in payload
            ? String((payload as { message: unknown }).message)
            : `Smriti couldn’t reply (${response.status}).`;
        const error = new ApiError(response.status, messageText);
        if (payload && typeof payload === "object" && "code" in payload)
          error.code = String((payload as { code: unknown }).code);
        throw error;
      }
      if (!response.body) throw new Error("Smriti couldn’t open a reply stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let turn: Turn | null = null;
      let started: { conversation_id: string; user_message: Message } | null = null;
      let text = "";
      const consume = (raw: string) => {
        let event = "message";
        let data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) return;
        const parsed = JSON.parse(data);
        if (event === "start") {
          started = parsed as { conversation_id: string; user_message: Message };
        } else if (event === "delta") {
          text += String(parsed.text ?? "");
          setStreamed(text);
        } else if (event === "done") {
          turn = {
            ...(parsed as Turn),
            conversation_id: parsed.conversation_id ?? started?.conversation_id,
            user_message: parsed.user_message ?? started?.user_message,
          } as Turn;
        } else if (event === "error") {
          const error = new ApiError(
            Number(parsed.status) || 503,
            String(parsed.message ?? "Smriti couldn’t finish that reply."),
          );
          if (parsed.code) error.code = String(parsed.code);
          throw error;
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          consume(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
        }
        if (done) break;
      }
      if (buffer.trim()) consume(buffer);
      if (!turn) throw new Error("Smriti’s reply ended before it was complete. Please retry.");
      return turn;
    },
    onMutate: () => setStreamed(""),
    onSuccess: (turn, submitted) => {
      if (
        !mounted.current ||
        cache.getQueryData<{ id: string } | null>(["me"])?.id !== submitted.ownerId
      )
        return;
      cache.setQueryData<Message[]>(["messages", turn.conversation_id], (old) => [
        ...(old ?? []),
        turn.user_message,
        turn.assistant_message,
      ]);
      void cache.invalidateQueries({ queryKey: ["threads"] });
      void cache.invalidateQueries({ queryKey: ["memories"] });
      void cache.invalidateQueries({ queryKey: ["hints"] });
      void cache.invalidateQueries({ queryKey: ["home"] });
      setStreamed("");
      setDraft((current) => (current.trim() === submitted.message ? "" : current));
      setTurnSuggestions((old) => ({
        ...old,
        [turn.assistant_message.id]: turn.suggested_memory_ids,
      }));
      router.replace(`/app?chat=${turn.conversation_id}`, { scroll: false });
      if (input.current) input.current.style.height = "auto";
    },
    onError: () => setStreamed(""),
  });
  const memoryAction = useMutation({
    mutationFn: ({
      id,
      action,
      version,
    }: {
      id: string;
      action: "save" | "dismiss" | "forget";
      version?: number;
    }) =>
      request(`/v1/memories/${id}${action === "save" ? "/confirm" : ""}`, {
        method: action === "forget" ? "DELETE" : action === "dismiss" ? "PATCH" : "POST",
        body: action === "dismiss" ? JSON.stringify({ status: "rejected", version }) : undefined,
      }),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ["memories"] }),
  });
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      cache.clear();
      router.replace("/login");
      router.refresh();
    },
  });
  const invite = params.get("invite");
  const accept = useMutation({
    mutationFn: () => request(`/v1/invites/${invite}/accept`, { method: "POST" }),
    onSuccess: () => {
      void cache.invalidateQueries();
      router.replace("/app");
    },
  });

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.data, send.isPending, conversation]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false);
        setPanel(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  function choose(id?: string) {
    if (send.isPending) return;
    send.reset();
    setMobile(false);
    router.push(id ? `/app?chat=${id}` : "/app", { scroll: false });
    input.current?.focus();
  }
  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || send.isPending || !space) return;
    if ((integration.data?.ai_configured ?? integration.data?.openai_configured) === false) return;
    send.mutate({ message: text, ownerId: user.id });
  }
  function start(text: string) {
    setDraft(text);
    input.current?.focus();
  }
  function showHint() {
    document.querySelector(".sc-care-hints")?.scrollIntoView({ block: "center" });
  }
  const hasMessages = !!messages.data?.length || send.isPending || send.isError;
  const aiMissing =
    (integration.data?.ai_configured ?? integration.data?.openai_configured) === false ||
    (send.error instanceof ApiError && send.error.code === "ai_not_configured");
  const errors =
    send.error || messages.error || preferences.error || remember.error || signOut.error;

  return (
    <div className="smriti-chat">
      {mobile && (
        <button
          className="sc-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sc-sidebar ${mobile ? "sc-sidebar-open" : ""}`}>
        <div className="sc-brand">
          <Logo />
          <button
            className="sc-icon sc-mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <button className="sc-new-chat" onClick={() => choose()} disabled={send.isPending}>
          <Plus size={18} />
          {copy.nav.home === "Home" ? "New chat" : "नई चैट"}
        </button>
        <AppNavigation onNavigate={() => setMobile(false)} />
        <div className="sc-history-label">
          {copy.nav.home === "Home" ? "Your chats" : "आपकी चैट"}
        </div>
        <nav className="sc-history" aria-label="Recent conversations">
          {threads.isPending ? (
            <span className="sc-subtle">Loading conversations…</span>
          ) : threads.data?.length ? (
            threads.data.map((thread) => (
              <button
                key={thread.id}
                title={thread.title}
                aria-current={conversation === thread.id ? "page" : undefined}
                disabled={send.isPending}
                onClick={() => choose(thread.id)}
              >
                <MessageCircle size={15} />
                <span>{thread.title}</span>
              </button>
            ))
          ) : (
            <p className="sc-subtle">Your conversations will appear here.</p>
          )}
        </nav>
        <div className="sc-account">
          <span className="sc-avatar">{user.name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{copy.nav.home === "Home" ? "Personal space" : "निजी जगह"}</small>
          </div>
          <details>
            <summary aria-label="Account menu">
              <ChevronDown size={16} />
            </summary>
            <div className="sc-account-menu">
              <Link href="/app/settings">
                <Settings size={16} />
                {copy.nav.settings}
              </Link>
              <button onClick={() => signOut.mutate()}>
                <LogOut size={16} />
                {copy.nav.home === "Home" ? "Sign out" : "साइन आउट"}
              </button>
            </div>
          </details>
        </div>
      </aside>
      <main id="main" className="sc-main">
        <header className="sc-header">
          <div className="sc-header-name">
            <button
              className="sc-icon sc-mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <strong>
                Smriti <span>AI</span>
              </strong>
              <small>
                <LockKeyhole size={11} />
                Your private companion
              </small>
            </div>
          </div>
          <div className="sc-header-actions">
            <LanguageToggle />
            <HelpLink label="Help and guide" />
            <button
              className={`sc-memory-toggle ${memoryOn && !isIncognito ? "sc-memory-on" : ""}`}
              role="switch"
              aria-checked={memoryOn && !isIncognito}
              aria-label="Remember things from my chats"
              disabled={remember.isPending || !preferences.data || isIncognito}
              onClick={() => remember.mutate()}
              title={
                isIncognito
                  ? "Incognito conversations never create memories."
                  : "Smriti suggests memories when this is on. You approve what gets saved."
              }
            >
              <span className="sc-switch-track">
                <i />
              </span>
              <span>Memory {memoryOn && !isIncognito ? "on" : "off"}</span>
            </button>
            <button className="sc-icon" aria-label="Open memory" onClick={() => setPanel("saved")}>
              <BookOpen size={19} />
              {(suggested.data?.length ?? 0) > 0 && <i className="sc-unread-dot" />}
            </button>
          </div>
        </header>
        {notice && !noticeDismissed && (
          <div className="sc-friendly-notice" role="status">
            <LockKeyhole size={17} />
            <span>
              {notice === "heritage-off"
                ? "Heritage is unavailable on this deployment. Your stories are still here."
                : "Advanced tools are off. Turn them on in Settings when you want Heritage or Groups."}
            </span>
            <Link href="/app/settings">Open Settings</Link>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setNoticeDismissed(true)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className={`sc-messages ${!hasMessages ? "sc-messages-empty" : ""}`}>
          <CareHints
            spaceId={space?.id}
            onPlan={(text) => setDraft((current) => (current ? `${current}\n${text}` : text))}
          />
          {!conversation && !hasMessages && <HomeDashboard onStart={start} onShowHint={showHint} />}
          {conversation && messages.isPending && (
            <p className="sc-loading" aria-busy="true">
              Opening your conversation…
            </p>
          )}
          <div className="sc-message-list">
            {messages.data?.map((message) => (
              <article
                key={message.id}
                className={`sc-message ${message.author_user_id ? "sc-user-message" : "sc-assistant-message"}`}
                aria-label={message.author_user_id ? "Your message" : "Smriti reply"}
              >
                {!message.author_user_id && (
                  <span className="sc-bot-avatar">
                    <Sparkles size={18} />
                  </span>
                )}
                <div className="sc-message-content">
                  <div className="sc-message-body">{message.body}</div>
                  {!!message.citations?.length && (
                    <div className="sc-sources">
                      {message.citations.map((c) => (
                        <Link key={c.number} href={`/app/memory/${c.memory_id}`} title={c.summary}>
                          <BookOpen size={12} />
                          {c.number}. Memory
                        </Link>
                      ))}
                    </div>
                  )}
                  {!message.author_user_id &&
                    (() => {
                      const ids = turnSuggestions[message.id] ?? message.suggested_memory_ids ?? [];
                      const cards = ids
                        .map((id) => suggested.data?.find((memory) => memory.id === id))
                        .filter((memory): memory is Memory => !!memory);
                      if (!cards.length) return null;
                      return (
                        <div className="sc-remember-list">
                          {cards.map((memory) => (
                            <RememberCard key={memory.id} memory={memory} />
                          ))}
                        </div>
                      );
                    })()}
                </div>
              </article>
            ))}
            {(send.isPending || send.isError) && (
              <>
                <article className="sc-message sc-user-message">
                  <div className="sc-message-content">
                    <div className="sc-message-body">{send.variables?.message}</div>
                  </div>
                </article>
                {send.isPending && (
                  <article className="sc-message sc-assistant-message" aria-live="polite">
                    <span className="sc-bot-avatar">
                      <Sparkles size={18} />
                    </span>
                    {streamed ? (
                      <div className="sc-message-content">
                        <div className="sc-message-body sc-streaming">{streamed}</div>
                        <span className="sc-streaming-caret" aria-hidden="true" />
                      </div>
                    ) : (
                      <div className="sc-thinking">
                        <i />
                        <i />
                        <i />
                        <span>Smriti is thinking</span>
                      </div>
                    )}
                  </article>
                )}
              </>
            )}
            <div ref={end} />
          </div>
        </div>
        <div className="sc-compose-area">
          <div className="sc-compose-inner">
            {aiMissing && (
              <div className="sc-connect-notice">
                <KeyRound size={15} />
                <span>Add an API key in backend/.env</span>
                <button onClick={() => setConnection(true)}>Connect AI</button>
              </div>
            )}
            {errors &&
              !(send.error instanceof ApiError && send.error.code === "ai_not_configured") && (
                <p className="sc-error" role="alert">
                  {errors.message}
                  {send.isError && (
                    <button
                      type="button"
                      onClick={() => send.variables && send.mutate(send.variables)}
                    >
                      Retry
                    </button>
                  )}
                </p>
              )}
            <form className="sc-composer" onSubmit={submit}>
              <textarea
                ref={input}
                aria-label="Message Smriti"
                placeholder={copy.nav.home === "Home" ? "Message Smriti…" : "Smriti को संदेश लिखें…"}
                value={draft}
                maxLength={8000}
                rows={1}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <div className="sc-composer-bottom">
                <div className="sc-composer-links">
                  <Link href="/app/record" title="Record a story">
                    <Mic size={17} />
                    <span>{copy.common.record}</span>
                  </Link>
                  {!conversation && (
                    <button
                      type="button"
                      className={incognito ? "sc-incognito-active" : ""}
                      onClick={() => setIncognito(!incognito)}
                      aria-pressed={incognito}
                    >
                      <LockKeyhole size={15} />
                      Incognito
                    </button>
                  )}
                  {isIncognito && conversation && (
                    <span className="sc-incognito-label">
                      <LockKeyhole size={13} />
                      Incognito
                    </span>
                  )}
                </div>
                <button
                  className="sc-send"
                  type="submit"
                  disabled={!draft.trim() || send.isPending || !space}
                  aria-label="Send message"
                >
                  <ArrowUp size={20} />
                </button>
              </div>
            </form>
            <p className="sc-compose-caption">
              Private by default. You decide what becomes a memory.
            </p>
          </div>
        </div>
      </main>
      <MobileTabBar />
      <Modal
        open={panel !== null}
        onOpenChange={(value) => {
          if (!value) setPanel(null);
        }}
        title="Smriti’s memory"
        description="Saved memories stay with you across conversations. You always have the final say."
      >
        <div className="sc-memory-tabs">
          <button aria-pressed={panel === "saved"} onClick={() => setPanel("saved")}>
            Saved · {saved.data?.length ?? 0}
          </button>
          <button aria-pressed={panel === "suggested"} onClick={() => setPanel("suggested")}>
            For review · {suggested.data?.length ?? 0}
          </button>
        </div>
        {(panel === "suggested" ? suggested : saved).isPending ? (
          <p>Opening memory…</p>
        ) : (panel === "suggested" ? suggested.data : saved.data)?.length ? (
          (panel === "suggested" ? suggested.data : saved.data)?.map((memory) => (
            <div key={memory.id} className="sc-memory-item">
              <p>{memory.summary}</p>
              {panel === "suggested" && memory.sources?.[0] && (
                <blockquote>“{memory.sources[0].quote}”</blockquote>
              )}
              <div>
                {panel === "suggested" ? (
                  <>
                    <button
                      disabled={memoryAction.isPending}
                      onClick={() => memoryAction.mutate({ id: memory.id, action: "save" })}
                    >
                      <Check size={14} />
                      Save memory
                    </button>
                    <button
                      disabled={memoryAction.isPending}
                      onClick={() =>
                        memoryAction.mutate({
                          id: memory.id,
                          action: "dismiss",
                          version: memory.version,
                        })
                      }
                    >
                      Not now
                    </button>
                  </>
                ) : (
                  <button
                    disabled={memoryAction.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Forget this saved memory? The original conversation stays in your chat history.",
                        )
                      )
                        memoryAction.mutate({ id: memory.id, action: "forget" });
                    }}
                  >
                    Forget
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="sc-memory-empty">
            <BookOpen size={26} />
            <h3>{panel === "saved" ? "Nothing saved yet" : "You’re all caught up"}</h3>
            <p>
              {panel === "saved"
                ? "Turn memory on and chat naturally. Smriti will suggest things to keep, and you approve them here."
                : "When you share something worth keeping, it will appear here for your approval."}
            </p>
          </div>
        )}
        {(memoryAction.error || saved.error || suggested.error) && (
          <p className="sc-error" role="alert">
            {(memoryAction.error || saved.error || suggested.error)?.message}
          </p>
        )}
        <Link className="sc-manage-memory" href="/app/memory">
          Open Stories Smriti remembers →
        </Link>
      </Modal>
      <Modal
        open={connection}
        onOpenChange={setConnection}
        title="Connect Smriti’s AI"
        description="The chat and memory system are ready. An OpenAI key is needed for actual AI replies."
      >
        <ol className="sc-connect-steps">
          <li>
            Add <code>OPENAI_API_KEY=your-key</code> to <code>backend/.env</code>.
          </li>
          <li>Restart the FastAPI server and the background worker.</li>
          <li>Return here and start your conversation.</li>
        </ol>
        <p>Your key stays on the server. It is never saved in the browser.</p>
        <button
          onClick={() => {
            void cache.invalidateQueries({ queryKey: ["integrations"] });
            setConnection(false);
          }}
        >
          I’ve connected it · Check again
        </button>
      </Modal>
      <Modal
        open={!!invite}
        onOpenChange={(value) => {
          if (!value) router.replace("/app");
        }}
        title="Join your family"
        description="Accepting this invitation adds you to the family. Your personal chats remain private."
      >
        <button disabled={accept.isPending} onClick={() => accept.mutate()}>
          Accept invitation
        </button>
        {accept.error && <p role="alert">{accept.error.message}</p>}
      </Modal>
    </div>
  );
}
