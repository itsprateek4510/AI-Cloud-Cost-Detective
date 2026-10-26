"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import {
  type Recording,
  type Person,
  type Segment,
  type InterviewDetail,
  time,
} from "@/lib/domain";
import { useApp } from "./provider";
import { Heading, Empty, ErrorState, Modal } from "./common";
import { VisibilityBadge } from "./shell";
import { RawShare } from "./raw-share";

export function Recordings() {
  const { user } = useApp();
  const recordings = useQuery({
    queryKey: ["recordings"],
    queryFn: () => request<Recording[]>("/v1/recordings"),
    refetchInterval: 5000,
  });
  return (
    <>
      <Heading
        eyebrow="In their own words"
        title="Your recordings"
        description="All recordings you can access, across your personal and shared workspaces. Open a recording for its audio, transcript, and sharing controls."
      >
        <Link href="/app/record" className="eco-primary">
          Record a memory
        </Link>
      </Heading>
      <ErrorState error={recordings.error} />
      {recordings.isPending ? (
        <p>Opening recordings…</p>
      ) : recordings.data?.length ? (
        <div className="eco-list">
          {recordings.data.map((r) => (
            <Link
              className="eco-card"
              style={{ textDecoration: "none" }}
              key={r.id}
              href={`/app/recordings/${r.id}`}
            >
              <div className="eco-card-top">
                <h2>{r.title}</h2>
                <VisibilityBadge
                  personal={r.owner_user_id === user.id}
                  label={r.owner_user_id === user.id ? "Your recording" : "Shared with you"}
                />
              </div>
              <p>
                {r.duration ? `${time(r.duration * 1000)} · ` : ""}
                {r.status === "ready" ? "Ready to revisit" : r.status}
              </p>
              {r.error && <p className="eco-error">{r.error}</p>}
            </Link>
          ))}
        </div>
      ) : !recordings.error ? (
        <Empty
          title="Every voice has a story"
          description="Record yourself, sit down with a relative, or upload audio you already have."
        >
          <Link className="eco-link-button" href="/app/record">
            Make your first recording
          </Link>
        </Empty>
      ) : null}
    </>
  );
}

export function Studio() {
  const params = useSearchParams();
  const interviewId = params.get("interview");
  const question = params.get("question") ?? "";
  const interview = useQuery({
    queryKey: ["interview", interviewId],
    queryFn: () => request<InterviewDetail>(`/v1/interviews/${interviewId}`),
    enabled: !!interviewId,
  });
  const { space, families } = useApp();
  const router = useRouter();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(params.get("person") ?? "");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const parts = useRef<Blob[]>([]);
  const media = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const started = useRef(0);
  const animation = useRef(0);
  const [level, setLevel] = useState(0);
  const context = useRef<AudioContext | null>(null);
  const fid =
    interview.data?.family_id ?? params.get("family") ?? space?.family_id ?? families[0]?.id;
  const people = useQuery({
    queryKey: ["persons", fid],
    queryFn: () => request<Person[]>(`/v1/families/${fid}/persons`),
    enabled: !!fid,
  });
  useEffect(() => {
    if (status !== "recording") return;
    const tick = setInterval(() => {
      setSeconds((s) => {
        if (s >= 3599) media.current?.stop();
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [status]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (media.current?.state === "recording" || parts.current.length) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    const navigate = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
      if (
        (media.current?.state === "recording" || parts.current.length > 0) &&
        !window.confirm(
          "Leave this recording? Unsaved audio will be lost if you leave this screen.",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
      if (media.current?.state !== "inactive") media.current?.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animation.current);
      void context.current?.close();
    };
  }, []);
  async function createRecording() {
    if (interviewId && !interview.data) throw new Error("Open the interview before recording.");
    const r = await request<Recording>("/v1/recordings", {
      method: "POST",
      body: JSON.stringify({
        space_id: interviewId ? interview.data!.space_id : space?.id,
        title: title || "A new story",
        subject_person_id: interviewId ? interview.data!.subject_person_id : subject || null,
        consent_confirmed: consent,
        interview_id: interviewId || undefined,
        question: interviewId ? question : undefined,
      }),
    });
    setRecording(r);
    return r;
  }
  async function uploadPart(id: string, blob: Blob, index: number) {
    const token = await request<{ token: string }>(`/v1/recordings/${id}/upload-token`);
    const response = await fetch(
      `/v1/recordings/${id}/parts/${index}?token=${encodeURIComponent(token.token)}`,
      { method: "PUT", body: blob, credentials: "include" },
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail ?? "Upload interrupted. Retry without closing this tab.");
    }
  }
  async function start() {
    setError("");
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("This browser cannot record audio. Upload a file below instead.");
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = microphone;
      const r = await createRecording();
      const recorder = new MediaRecorder(microphone);
      media.current = recorder;
      parts.current = [];
      queue.current = Promise.resolve();
      setSeconds(0);
      recorder.ondataavailable = (e) => {
        if (!e.data.size) return;
        const i = parts.current.length;
        parts.current.push(e.data);
        queue.current = queue.current
          .then(() => uploadPart(r.id, e.data, i))
          .catch((e) => {
            setError((e as Error).message);
          });
      };
      recorder.onstop = () => {
        microphone.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animation.current);
        void context.current?.close();
        setStatus("review");
      };
      recorder.onerror = () => {
        setError("Recording was interrupted. Your captured parts can still be uploaded.");
        recorder.stop();
      };
      recorder.start(10000);
      started.current = Date.now();
      setStatus("recording");
      try {
        const audio = new AudioContext();
        context.current = audio;
        const analyser = audio.createAnalyser();
        audio.createMediaStreamSource(microphone).connect(analyser);
        analyser.fftSize = 256;
        const values = new Uint8Array(analyser.frequencyBinCount);
        const meter = () => {
          analyser.getByteFrequencyData(values);
          setLevel(values.reduce((a, b) => a + b, 0) / values.length);
          animation.current = requestAnimationFrame(meter);
        };
        meter();
      } catch {
        /* Recording still works if level metering is unavailable. */
      }
    } catch (e) {
      setError((e as Error).message);
      stream.current?.getTracks().forEach((t) => t.stop());
    } finally {
      setBusy(false);
    }
  }
  async function finish(file?: File) {
    setError("");
    setBusy(true);
    try {
      if (file && file.size > 250 * 1024 * 1024)
        throw new Error("Choose an audio file smaller than 250 MB.");
      if (
        file &&
        !/^audio\//.test(file.type) &&
        !/\.(wav|mp3|m4a|mp4|webm|ogg|opus|flac)$/i.test(file.name)
      )
        throw new Error("Choose a supported audio file such as WAV, MP3, M4A, OGG, or WebM.");
      if (file) {
        setStatus("review");
        parts.current = [];
        for (let offset = 0; offset < file.size; offset += 8 * 1024 * 1024)
          parts.current.push(file.slice(offset, offset + 8 * 1024 * 1024));
      }
      const r = file ? await createRecording() : (recording ?? (await createRecording()));
      await queue.current;
      for (let i = 0; i < parts.current.length; i++) {
        await uploadPart(r.id, parts.current[i], i);
        setProgress(Math.round(((i + 1) / parts.current.length) * 100));
      }
      await request(`/v1/recordings/${r.id}/complete`, { method: "POST" });
      parts.current = [];
      void client.invalidateQueries({ queryKey: ["recordings"] });
      router.push(
        interviewId ? `/app/legacy/interviews/${interviewId}` : `/app/recordings/${r.id}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="A moment worth keeping"
        title="Recording studio"
        description="Find a quiet spot. Ask one question. Let the story take its time."
      />
      {interviewId && (
        <div className="eco-card">
          <Link href={`/app/legacy/interviews/${interviewId}`}>← Return to interview</Link>
          <h2>{interview.data?.subject_name ?? "Opening interview…"}</h2>
          <p>{question || "Return to the interview and choose a question."}</p>
          <p className="eco-caption">
            This response stays in your private archive. Transcription uses the existing pipeline;
            no interview memories are created automatically. You may skip any question.
          </p>
          <ErrorState error={interview.error} />
        </div>
      )}
      <div className="eco-card eco-form">
        <VisibilityBadge label="Only you · no automatic sharing" />
        <label>
          Give this recording a title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            placeholder="The story of the first shop"
            disabled={status !== "idle"}
          />
        </label>
        <label>
          Who is speaking?
          <select
            value={interviewId ? (interview.data?.subject_person_id ?? subject) : subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setConsent(false);
            }}
            disabled={status !== "idle" || !!interviewId}
          >
            <option value="">Me</option>
            {people.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="eco-toggle">
          <input
            type="checkbox"
            checked={consent}
            disabled={status !== "idle"}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {subject || interviewId
            ? "This person agreed to being recorded and having this audio processed. I am recording their consent."
            : "I agree to record and process my voice for my private archive."}
        </label>
        <div style={{ textAlign: "center", padding: "30px 0" }}>
          <strong style={{ display: "block", fontSize: 32, marginBottom: 20 }}>
            {time(seconds * 1000)}
          </strong>
          {status === "idle" ? (
            <button
              className="eco-record-button"
              disabled={!consent || busy || (!!interviewId && (!interview.data || !question))}
              onClick={start}
            >
              {busy ? "Opening…" : "Record"}
            </button>
          ) : status === "review" ? (
            <p>Recording captured. Upload to keep the story going.</p>
          ) : (
            <div className="eco-actions" style={{ justifyContent: "center" }}>
              <button
                onClick={() => {
                  if (media.current?.state === "recording") {
                    media.current.pause();
                    setStatus("paused");
                  } else {
                    media.current?.resume();
                    setStatus("recording");
                  }
                }}
              >
                {status === "paused" ? "Resume" : "Pause"}
              </button>
              <button onClick={() => media.current?.stop()}>Stop recording</button>
            </div>
          )}
          <meter
            aria-label="Microphone level"
            style={{ width: "60%", display: "block", margin: "24px auto 0" }}
            min={0}
            max={128}
            value={level}
          />
        </div>
        {status === "review" && (
          <button className="eco-primary" disabled={busy} onClick={() => void finish()}>
            {busy ? `Uploading… ${progress}%` : "Save and process recording"}
          </button>
        )}
        {status === "idle" && (
          <label>
            Or upload existing audio · up to 60 minutes
            <input
              type="file"
              accept="audio/*,video/webm"
              disabled={!consent || busy || (!!interviewId && (!interview.data || !question))}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void finish(f);
              }}
            />
          </label>
        )}
        {busy && progress > 0 && (
          <progress
            aria-label="Upload progress"
            value={progress}
            max={100}
            style={{ width: "100%" }}
          />
        )}
        <ErrorState error={error || people.error} />
        <p className="eco-caption">
          Audio uploads in 10-second parts while you record. If the connection drops, keep this tab
          open and retry Save. Recordings stay private until you share a memory from them.
        </p>
      </div>
    </>
  );
}

const steps = ["queued", "normalising", "transcribing", "extracting", "ready"];
export function RecordingDetail({ id }: { id: string }) {
  const { user, spaces, families } = useApp();
  const client = useQueryClient();
  const router = useRouter();
  const player = useRef<HTMLAudioElement | null>(null);
  const [audio, setAudio] = useState("");
  const [position, setPosition] = useState(0);
  const [edit, setEdit] = useState<Segment | null>(null);
  const [text, setText] = useState("");
  const [speaker, setSpeaker] = useState("");
  const recording = useQuery({
    queryKey: ["recordings", id],
    queryFn: () => request<Recording>(`/v1/recordings/${id}`),
    refetchInterval: (query) =>
      ["ready", "failed"].includes(query.state.data?.status ?? "") ? false : 3000,
  });
  const familyId =
    spaces.find((s) => s.id === recording.data?.space_id)?.family_id ?? families[0]?.id;
  const people = useQuery({
    queryKey: ["persons", familyId],
    queryFn: () => request<Person[]>(`/v1/families/${familyId}/persons`),
    enabled: !!familyId,
  });
  const transcript = useQuery({
    queryKey: ["transcript", id, recording.data?.status],
    queryFn: () => request<Segment[]>(`/v1/recordings/${id}/transcript`),
    enabled: recording.data?.status === "ready" && recording.data?.level !== "summary",
  });
  const play = useMutation({
    mutationFn: () => request<{ url: string }>(`/v1/recordings/${id}/audio-url`),
    onSuccess: (data) => setAudio(data.url),
  });
  const download = useMutation({
    mutationFn: () => request<{ url: string }>(`/v1/recordings/${id}/original-url`),
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = data.url;
      a.download = "";
      a.click();
    },
  });
  const extractAgain = useMutation({
    mutationFn: () => request(`/v1/recordings/${id}/extract`, { method: "POST" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["memories"] }),
  });
  const retry = useMutation({
    mutationFn: () => request(`/v1/recordings/${id}/complete`, { method: "POST" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["recordings", id] }),
  });
  const save = useMutation({
    mutationFn: () =>
      request(`/v1/transcript-segments/${edit?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ edited_text: text, speaker_person_id: speaker || null }),
      }),
    onSuccess: () => {
      setEdit(null);
      void client.invalidateQueries({ queryKey: ["transcript", id] });
      void client.invalidateQueries({ queryKey: ["memories"] });
    },
  });
  const remove = useMutation({
    mutationFn: () => request(`/v1/recordings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["recordings"] });
      router.push("/app/recordings");
    },
  });
  const r = recording.data;
  const owner = r?.owner_user_id === user.id;
  return (
    <>
      <Link href="/app/recordings">← Recordings</Link>
      <div style={{ marginTop: 24 }}>
        <Heading eyebrow="The original voice" title={r?.title ?? "Opening recording…"} />
      </div>
      <ErrorState
        error={
          recording.error ||
          transcript.error ||
          play.error ||
          retry.error ||
          save.error ||
          remove.error ||
          download.error ||
          extractAgain.error
        }
      />
      {r && (
        <>
          <div className="eco-card">
            <div className="eco-card-top">
              <VisibilityBadge
                personal={owner}
                label={owner ? "You own this" : `Shared · ${r.level}`}
              />
              <span className="eco-badge">{r.status}</span>
            </div>
            {!steps.includes(r.status) ? (
              <p>
                {r.status === "failed"
                  ? r.error
                  : "Finish uploading this recording to begin processing."}
              </p>
            ) : (
              <ol
                aria-label="Processing progress"
                className="eco-meta"
                style={{ marginTop: 20, gap: 20, listStyle: "none", padding: 0 }}
              >
                {steps.map((step, i) => (
                  <li key={step} aria-current={step === r.status ? "step" : undefined}>
                    {steps.indexOf(r.status) >= i ? "●" : "○"} {step}
                  </li>
                ))}
              </ol>
            )}
            {r.status === "failed" && owner && (
              <button disabled={retry.isPending} onClick={() => retry.mutate()}>
                Retry processing
              </button>
            )}
            {(owner
              ? !["created", "uploading"].includes(r.status)
              : r.status === "ready" && r.level === "audio") && (
              <>
                <button disabled={play.isPending} onClick={() => play.mutate()}>
                  {audio ? "Refresh audio link" : "Load audio for playback"}
                </button>
                {audio && (
                  <audio
                    ref={player}
                    src={audio}
                    controls
                    preload="none"
                    onTimeUpdate={() => setPosition((player.current?.currentTime ?? 0) * 1000)}
                    onError={() => setAudio("")}
                  />
                )}
                <p className="eco-caption">
                  Audio links expire quickly. Refresh the link if playback expires.
                </p>
              </>
            )}
          </div>
          {r.owner_user_id === user.id && (
            <div className="eco-actions">
              <RawShare type="recording" id={id} />
              <button disabled={download.isPending} onClick={() => download.mutate()}>
                Download original audio
              </button>
            </div>
          )}
          {!!transcript.data?.length && (
            <section className="eco-card">
              <h2>Transcript</h2>
              <p className="eco-caption">
                Click a line to seek. Corrections keep the original and remove dependent memories
                from answers until reviewed again.
              </p>
              <div className="eco-transcript">
                {transcript.data.map((s) => (
                  <div key={s.id}>
                    <button
                      style={{
                        background:
                          position >= s.start_ms && position < s.end_ms ? "#edf2e7" : undefined,
                      }}
                      onClick={() => {
                        if (player.current) {
                          player.current.currentTime = s.start_ms / 1000;
                          void player.current.play();
                        } else play.mutate();
                      }}
                    >
                      <small>{time(s.start_ms)}</small>　{s.edited_text ?? s.text}
                    </button>
                    {owner && (
                      <button
                        onClick={() => {
                          setEdit(s);
                          setText(s.edited_text ?? s.text);
                          setSpeaker(s.speaker_person_id ?? "");
                        }}
                      >
                        Correct text
                      </button>
                    )}
                    {s.edited_text && (
                      <details>
                        <summary>Original transcript</summary>
                        <p>{s.text}</p>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {r.status === "ready" && owner && (
            <section className="eco-card">
              <span className="eco-eyebrow">Continue the flow</span>
              <h2>{r.followups?.[0] ?? "What happened next?"}</h2>
              <p>
                You’ve kept {r.duration ? time(r.duration * 1000) : "a recording"} of this story.
                {r.auto_extract === false
                  ? "Return to your interview to review excerpts before creating any memories."
                  : "Review its suggested memories, or follow the next thread."}
              </p>
              <div className="eco-actions">
                <Link className="eco-primary" href="/app/record">
                  Record next
                </Link>
                <Link href="/app/memory">Review suggested memories →</Link>
                {r.auto_extract !== false && (
                  <button disabled={extractAgain.isPending} onClick={() => extractAgain.mutate()}>
                    Suggest memories from corrected transcript
                  </button>
                )}
              </div>
            </section>
          )}
          {owner && (
            <button
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Delete this source recording? All dependent memories will immediately leave retrieval.",
                  )
                )
                  remove.mutate();
              }}
            >
              Delete recording
            </button>
          )}
        </>
      )}
      <Modal
        open={!!edit}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
        title="Correct the transcript"
        description="The original text is preserved. Sourced memories will need fresh review."
      >
        <form
          className="eco-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label>
            Corrected words
            <textarea value={text} onChange={(e) => setText(e.target.value)} required />
          </label>
          <label>
            Speaker
            <select value={speaker} onChange={(e) => setSpeaker(e.target.value)}>
              <option value="">Not tagged</option>
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          <button className="eco-primary" disabled={save.isPending}>
            Save correction
          </button>
        </form>
      </Modal>
    </>
  );
}
