"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Mic, RefreshCw } from "lucide-react";
import { request } from "@/lib/api";
import type { Memory, Recording } from "@/lib/domain";
import { copyFor } from "@/lib/i18n";
import { useApp } from "./provider";
import { Heading, Empty, ErrorState } from "./common";
import { MemoryCard } from "./memory-center";
import { VisibilityBadge } from "./shell";

type Filter = "mine" | "shared" | "review";

function seconds(value: number | null) {
  if (!value) return "";
  const total = Math.round(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function RecordingCard({ recording }: { recording: Recording }) {
  const { user } = useApp();
  const owner = recording.owner_user_id === user.id;
  return (
    <Link className="eco-card stories-recording" href={`/app/recordings/${recording.id}`}>
      <div className="eco-card-top">
        <div className="eco-meta">
          <span>
            <Mic size={13} /> Recording
          </span>
          <span>·</span>
          <span>{recording.status === "ready" ? "Ready to revisit" : recording.status}</span>
        </div>
        <VisibilityBadge
          personal={owner}
          label={owner ? "Your recording" : "Shared with you"}
        />
      </div>
      <h2>{recording.title}</h2>
      <p className="eco-caption">
        {recording.duration ? `${seconds(recording.duration)} · ` : ""}
        {owner ? "Kept in your voice" : "Shared with you"}
      </p>
      {recording.error && <p className="eco-error">{recording.error}</p>}
    </Link>
  );
}

export function StoriesHub() {
  const { user } = useApp();
  const copy = copyFor(user.locale);
  const [filter, setFilter] = useState<Filter>("mine");
  const filters: { key: Filter; label: string }[] = [
    { key: "mine", label: copy.stories.mine },
    { key: "shared", label: copy.stories.shared },
    { key: "review", label: copy.stories.needsReview },
  ];
  const confirmed = useQuery({
    queryKey: ["stories", "confirmed"],
    queryFn: () => request<Memory[]>("/v1/memories?tab=confirmed"),
  });
  const suggested = useQuery({
    queryKey: ["stories", "suggested"],
    queryFn: () => request<Memory[]>("/v1/memories?tab=suggested"),
  });
  const recordings = useQuery({
    queryKey: ["stories", "recordings"],
    queryFn: () => request<Recording[]>("/v1/recordings"),
    refetchInterval: 5000,
  });
  const active = filter === "review" ? suggested : confirmed;
  const memories =
    active.data?.filter((memory) =>
      filter === "mine"
        ? memory.owner_user_id === user.id
        : filter === "shared"
          ? memory.owner_user_id !== user.id
          : true,
    ) ?? [];
  const voices =
    filter === "review"
      ? []
      : (recordings.data ?? []).filter((recording) =>
          filter === "mine"
            ? recording.owner_user_id === user.id
            : recording.owner_user_id !== user.id,
        );
  const empty =
    filter === "mine"
      ? copy.stories.emptyMine
      : filter === "shared"
        ? copy.stories.emptyShared
        : copy.stories.emptyReview;
  const loading = active.isPending || (filter !== "review" && recordings.isPending);
  const error = active.error || (filter !== "review" ? recordings.error : null);

  function retry() {
    void active.refetch();
    if (filter !== "review") void recordings.refetch();
  }

  return (
    <>
      <Heading eyebrow="Sourced. Reviewed. Remembered." title={copy.stories.title} description={copy.stories.description}>
        <Link className="eco-primary stories-record" href="/app/record">
          <Mic size={16} /> {copy.stories.record}
        </Link>
      </Heading>
      <div className="stories-toolbar">
        <div className="stories-filters" role="group" aria-label="Story filters">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="eco-caption">
          {loading ? copy.common.loading : `${memories.length + voices.length} stories`}
        </span>
      </div>
      <ErrorState error={error} />
      {error ? (
        <button type="button" className="eco-secondary stories-retry" onClick={retry}>
          <RefreshCw size={14} /> {copy.common.retry}
        </button>
      ) : loading ? (
        <div className="stories-skeleton" aria-busy="true" aria-label={copy.common.loading}>
          <span className="eco-skeleton-line" />
          <span className="eco-skeleton-line" />
          <span className="eco-skeleton-line" />
        </div>
      ) : memories.length || voices.length ? (
        <div className="stories-list">
          {memories.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
          {voices.map((recording) => (
            <RecordingCard key={recording.id} recording={recording} />
          ))}
        </div>
      ) : (
        <Empty title={copy.stories.title} description={empty}>
          <Link className="eco-primary" href={filter === "review" ? "/app" : "/app/record"}>
            {filter === "review" ? (
              <>
                <BookOpen size={15} /> {copy.nav.home}
              </>
            ) : (
              <>
                <Mic size={15} /> {copy.stories.record}
              </>
            )}
          </Link>
        </Empty>
      )}
    </>
  );
}
