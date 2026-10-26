"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, BookOpen, Calendar, FileText, Mic, Sparkles, Star, Users } from "lucide-react";
import { request } from "@/lib/api";
import type {
  AuditEvent,
  Founder,
  Member,
  Memory,
  Person,
  Recording,
  TimelinePayload,
  VaultPayload,
} from "@/lib/domain";
import { useApp } from "../provider";

const ACTION_LABELS: Record<string, string> = {
  "memory.read": "viewed a shared memory",
  "memory.confirm": "confirmed a memory",
  "memory.edit": "edited a memory",
  "memory.forget": "forgot a memory",
  "memory.publish": "published a memory",
  "grant.create": "shared an item",
  "grant.revoke": "revoked sharing",
  "hint.proposed": "prepared a family hint",
  "hint.delivered": "delivered a family hint",
  "membership.role": "changed a member role",
  "membership.remove": "removed a member",
  "recording.read": "listened to a recording",
};

function humanAction(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function shortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function duration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function HeritageDashboard() {
  const { families, spaces, family, setFamily, setSpace } = useApp();
  const privateSpace = spaces.find((s) => s.type === "personal");

  const familySpaces = useMemo(
    () => spaces.filter((s) => family && s.family_id === family.id),
    [spaces, family],
  );
  const familySpace = familySpaces.find((s) => s.type === "family");
  const familySpaceIds = useMemo(() => new Set(familySpaces.map((s) => s.id)), [familySpaces]);

  const persons = useQuery({
    queryKey: ["legacy-persons", family?.id],
    queryFn: () => request<Person[]>(`/v1/families/${family!.id}/persons`),
    enabled: !!family,
  });
  const members = useQuery({
    queryKey: ["legacy-members", family?.id],
    queryFn: () => request<Member[]>(`/v1/families/${family!.id}/members`),
    enabled: !!family,
  });
  const memories = useQuery({
    queryKey: ["legacy-memories", familySpace?.id],
    queryFn: () => request<Memory[]>(`/v1/memories?space_id=${familySpace!.id}&tab=confirmed`),
    enabled: !!familySpace,
  });
  const recordings = useQuery({
    queryKey: ["legacy-recordings", family?.id],
    queryFn: () => request<Recording[]>("/v1/recordings"),
    enabled: !!family,
  });
  const activity = useQuery({
    queryKey: ["legacy-activity"],
    queryFn: () => request<AuditEvent[]>("/v1/audit"),
  });

  const roleByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members.data ?? []) map.set(member.id, member.role);
    return map;
  }, [members.data]);

  const familyRecordings = useMemo(
    () =>
      (recordings.data ?? []).filter(
        (r) =>
          familySpaceIds.has(r.space_id) ||
          (r.subject_person_id && persons.data?.some((p) => p.id === r.subject_person_id)),
      ),
    [recordings.data, familySpaceIds, persons.data],
  );

  const preserved = useMemo(() => memories.data ?? [], [memories.data]);

  if (!family) {
    return (
      <div className="legacy">
        <header className="legacy-head">
          <div>
            <span className="legacy-eyebrow">Smriti Legacy</span>
            <h1>Family Heritage Dashboard</h1>
            <p className="legacy-sub">
              A private record of who your family is and what you have chosen to keep.
            </p>
          </div>
        </header>
        <section className="legacy-hero" style={{ marginTop: 26 }}>
          <span className="legacy-hero-mark">Begin</span>
          <h2>No family yet</h2>
          <p>
            Create a family to open a heritage dashboard. Your personal chat and memories stay
            exactly as they are.
          </p>
          <p style={{ marginTop: 18 }}>
            <Link
              href="/onboarding"
              style={{
                color: "#cdb079",
                borderBottom: "1px solid rgba(205,176,121,0.6)",
              }}
            >
              Create a family →
            </Link>
          </p>
        </section>
      </div>
    );
  }

  const loading =
    persons.isLoading || members.isLoading || memories.isLoading || recordings.isLoading;
  const failed = persons.isError || members.isError || memories.isError || recordings.isError;

  if (failed) {
    return (
      <div className="legacy">
        <header className="legacy-head">
          <div>
            <span className="legacy-eyebrow">Smriti Legacy</span>
            <h1>Family Heritage Dashboard</h1>
          </div>
        </header>
        <p className="legacy-error" role="alert">
          {(persons.error as Error)?.message ??
            (members.error as Error)?.message ??
            memories.error?.message ??
            recordings.error?.message ??
            "This family could not be opened."}
        </p>
        <button
          className="legacy-button"
          onClick={() => {
            void persons.refetch();
            void members.refetch();
            if (familySpace) void memories.refetch();
            void recordings.refetch();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="legacy">
        <p className="legacy-loading" aria-busy="true">
          Assembling your heritage…
        </p>
      </div>
    );
  }

  const people = persons.data ?? [];
  const joined = people.filter((p) => p.linked_user_id).length;
  const recentActivity = (activity.data ?? []).slice(0, 8);

  return (
    <div className="legacy">
      <header className="legacy-head">
        <div>
          <span className="legacy-eyebrow">Smriti Legacy</span>
          <h1>Family Heritage Dashboard</h1>
          <p className="legacy-sub">
            A private, permission-aware record for {family.name}. Only what you are allowed to see
            appears here.
          </p>
        </div>
        {families.length > 1 && (
          <div className="legacy-family-picker">
            <label htmlFor="legacy-family">Family</label>
            <select
              id="legacy-family"
              aria-label="Family"
              value={family.id}
              onChange={(e) => {
                setFamily(e.target.value);
              }}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <section aria-labelledby="heritage-start">
        <h2 id="heritage-start">What would you like to do?</h2>
        <p>
          Start with a story. Review the memories it suggests, then choose what to share or put in a
          book.
        </p>
        <div className="eco-journey">
          <Link href="/app/legacy/interviews">
            <strong>1. Capture a story →</strong>
            <span>Use interview questions to guide a conversation and record it with consent.</span>
          </Link>
          <Link
            href="/app/memory"
            onClick={() => {
              if (privateSpace) setSpace(privateSpace.id);
            }}
          >
            <strong>2. Review memories →</strong>
            <span>
              Review your private interview memories, then explicitly share or publish what the
              family may use.
            </span>
          </Link>
          <Link
            href="/app/memory?tab=confirmed"
            onClick={() => {
              if (privateSpace) setSpace(privateSpace.id);
            }}
          >
            <strong>3. Choose what to share →</strong>
            <span>
              Confirmation does not share anything. Publish a separate copy or grant access to named
              relatives.
            </span>
          </Link>
          <Link href="/app/legacy/books">
            <strong>4. Make a family book →</strong>
            <span>Collect approved stories and photographs into an editable book.</span>
          </Link>
        </div>
      </section>

      <section className="legacy-hero" aria-labelledby="legacy-overview">
        <span className="legacy-hero-mark">Family Heritage Overview</span>
        <h2 id="legacy-overview">{family.name}</h2>
        <p>
          {family.created_at ? `Family space created ${shortDate(family.created_at)}. ` : ""}
          The archive grows only through what your family chooses to record, keep, and share.
        </p>
        <dl className="legacy-stats">
          <div className="legacy-stat">
            <dt>Family members</dt>
            <dd>{people.length}</dd>
          </div>
          <div className="legacy-stat">
            <dt>Joined accounts</dt>
            <dd>{joined}</dd>
          </div>
          <div className="legacy-stat">
            <dt>Preserved memories</dt>
            <dd>{preserved.length}</dd>
          </div>
          <div className="legacy-stat">
            <dt>Recorded stories</dt>
            <dd>{familyRecordings.length}</dd>
          </div>
        </dl>
      </section>

      <div className="legacy-grid">
        <section className="legacy-card">
          <CardHead icon={<Sparkles size={18} />} title="Family Legacy Assistant" />
          <p className="legacy-note">
            Ask about the family business, lessons, milestones, values, and challenges. Answers cite
            only confirmed memories shared with the whole family.
          </p>
          <Link className="legacy-button" href="/app/legacy/assistant">
            Ask the family archive →
          </Link>
        </section>
        <section className="legacy-card">
          <CardHead icon={<Mic size={18} />} title="AI Legacy Interviews" />
          <p className="legacy-note">
            Guide a private conversation through childhood, life lessons, values, and more. Record
            with consent, then decide what to preserve.
          </p>
          <Link className="legacy-button" href="/app/legacy/interviews">
            Begin an interview →
          </Link>
        </section>
        <FamilyMembersCard people={people} roleByUser={roleByUser} />
        <TimelineCard familyId={family.id} />
        <RecordedStoriesCard
          recordings={familyRecordings}
          onOpen={() => {
            if (familySpace) setSpace(familySpace.id);
          }}
        />
        <PreservedMemoriesCard
          memories={preserved}
          onOpen={() => {
            if (familySpace) setSpace(familySpace.id);
          }}
        />
        <DocumentsCard familyId={family.id} />
        <FounderLegacyCard familyId={family.id} />
        <HeritageBookCard />
        <RecentActivityCard events={recentActivity} />
      </div>
    </div>
  );
}

function CardHead({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count?: string;
}) {
  return (
    <div className="legacy-card-head">
      <span className="legacy-card-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      {count !== undefined && <span className="legacy-card-count">{count}</span>}
    </div>
  );
}

function FamilyMembersCard({
  people,
  roleByUser,
}: {
  people: Person[];
  roleByUser: Map<string, string>;
}) {
  return (
    <section className="legacy-card">
      <CardHead icon={<Users size={18} />} title="Family Members" count={`${people.length}`} />
      {people.length === 0 ? (
        <div className="legacy-empty">
          <span className="legacy-empty-icon" aria-hidden="true">
            <Users size={22} />
          </span>
          <strong>No family members yet</strong>
          <p>
            Add relatives to {""}
            <Link href="/app/people">People</Link> to begin a family tree.
          </p>
        </div>
      ) : (
        <ul className="legacy-list">
          {people.map((person) => {
            const role = person.linked_user_id ? roleByUser.get(person.linked_user_id) : undefined;
            return (
              <li key={person.id}>
                <span className="legacy-avatar" aria-hidden="true">
                  {initials(person.display_name)}
                </span>
                <div className="legacy-main">
                  <div className="legacy-title legacy-title--serif">{person.display_name}</div>
                  <div className="legacy-badges">
                    {role && <span className="legacy-badge legacy-badge--navy">{role}</span>}
                    {person.birth_year ? (
                      <span className="legacy-badge">b. {person.birth_year}</span>
                    ) : null}
                    {person.is_deceased ? <span className="legacy-badge">Remembered</span> : null}
                    <span className="legacy-badge">
                      {person.linked_user_id ? "Joined" : "Not joined"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TimelineCard({ familyId }: { familyId: string }) {
  const timeline = useQuery({
    queryKey: ["legacy-timeline", familyId],
    queryFn: () => request<TimelinePayload>(`/v1/families/${familyId}/timeline`),
  });
  const events = timeline.data?.events;
  const recent = useMemo(() => [...(events ?? [])].reverse().slice(0, 5), [events]);
  return (
    <section className="legacy-card">
      <CardHead
        icon={<Calendar size={18} />}
        title="Family Timeline"
        count={timeline.data ? String(events?.length ?? 0) : undefined}
      />
      {timeline.isLoading ? (
        <p className="legacy-note">Unrolling the family scroll…</p>
      ) : timeline.isError ? (
        <p className="legacy-error" role="alert">
          {(timeline.error as Error).message}
        </p>
      ) : !events?.length ? (
        <div className="legacy-empty">
          <span className="legacy-empty-icon" aria-hidden="true">
            <Calendar size={22} />
          </span>
          <strong>No timeline events yet</strong>
          <p>
            Births, businesses, photographs, and recorded stories your family adds will appear here
            in order, each keeping its sources.
          </p>
          <Link href="/app/legacy/timeline">Open the Family Heritage Timeline →</Link>
        </div>
      ) : (
        <>
          <ul className="legacy-list">
            {recent.map((event) => (
              <li key={event.id}>
                <span className="legacy-year">
                  {event.occurred_on ? event.occurred_on.slice(0, 4) : "—"}
                </span>
                <div className="legacy-main">
                  <div className="legacy-title legacy-title--serif">{event.title}</div>
                  <div className="legacy-meta">
                    {[event.person_name, event.category_label].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="legacy-note" style={{ marginTop: 14, marginBottom: 0 }}>
            <Link href="/app/legacy/timeline">Open the Family Heritage Timeline →</Link>
          </p>
        </>
      )}
    </section>
  );
}

function RecordedStoriesCard({
  recordings,
  onOpen,
}: {
  recordings: Recording[];
  onOpen: () => void;
}) {
  return (
    <section className="legacy-card">
      <CardHead icon={<Mic size={18} />} title="Recorded Stories" count={`${recordings.length}`} />
      {recordings.length === 0 ? (
        <div className="legacy-empty">
          <span className="legacy-empty-icon" aria-hidden="true">
            <Mic size={22} />
          </span>
          <strong>No stories recorded yet</strong>
          <p>
            Record a voice story in the family space and it will be kept here. {""}
            <Link href="/app/record" onClick={onOpen}>
              Record a memory
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="legacy-list">
          {recordings.slice(0, 6).map((recording) => (
            <li key={recording.id}>
              <div className="legacy-main">
                <Link
                  className="legacy-title legacy-title--serif"
                  href={`/app/recordings/${recording.id}`}
                >
                  {recording.title}
                </Link>
                <div className="legacy-meta">
                  {[recording.status, duration(recording.duration), shortDate(recording.created_at)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PreservedMemoriesCard({ memories, onOpen }: { memories: Memory[]; onOpen: () => void }) {
  return (
    <section className="legacy-card">
      <CardHead
        icon={<BookOpen size={18} />}
        title="Preserved Memories"
        count={`${memories.length}`}
      />
      {memories.length === 0 ? (
        <div className="legacy-empty">
          <span className="legacy-empty-icon" aria-hidden="true">
            <BookOpen size={22} />
          </span>
          <strong>No preserved memories yet</strong>
          <p>
            Confirmed memories in the family space are kept here. Personal memories stay private.{" "}
            <Link href="/app/memory" onClick={onOpen}>
              Open Stories Smriti remembers
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <ul className="legacy-list">
            {memories.slice(0, 5).map((memory) => (
              <li key={memory.id}>
                <div className="legacy-main">
                  <Link
                    className="legacy-title legacy-title--serif"
                    href={`/app/memory/${memory.id}`}
                  >
                    {memory.summary}
                  </Link>
                  <div className="legacy-meta">
                    {[memory.subject_name, memory.kind, shortDate(memory.created_at)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="legacy-badges">
                    <span className="legacy-badge legacy-badge--gold">{memory.kind}</span>
                    {memory.pinned && <span className="legacy-badge">Pinned</span>}
                    {memory.owner_name && (
                      <span className="legacy-badge">kept by {memory.owner_name}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {memories.length > 5 && (
            <p className="legacy-note" style={{ marginTop: 12, marginBottom: 0 }}>
              <Link href="/app/memory" onClick={onOpen}>
                +{memories.length - 5} more in Stories Smriti remembers →
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}

function DocumentsCard({ familyId }: { familyId: string }) {
  const vault = useQuery({
    queryKey: ["legacy-vault", familyId],
    queryFn: () => request<VaultPayload>(`/v1/families/${familyId}/vault`),
  });
  const files = vault.data?.files.filter((f) => f.status === "ready") ?? [];
  return (
    <section className="legacy-card">
      <CardHead
        icon={<FileText size={18} />}
        title="Documents"
        count={vault.data ? String(files.length) : undefined}
      />
      {vault.isLoading ? (
        <p className="legacy-note">Opening your permitted vault…</p>
      ) : vault.isError ? (
        <p className="legacy-error" role="alert">
          {vault.error.message}
        </p>
      ) : files.length ? (
        <ul className="legacy-list">
          {files.slice(0, 3).map((file) => (
            <li key={file.id}>
              <div className="legacy-main">
                <span className="legacy-title">{file.title}</span>
                <span className="legacy-meta">{file.category?.replaceAll("_", " ")}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="legacy-empty">
          <strong>No documents yet</strong>
          <p>
            Create a private collection for photographs, letters, documents, and permitted audio
            references.
          </p>
        </div>
      )}
      <p className="legacy-note">
        <Link href="/app/legacy/vault">Open Private Family Vault →</Link>
      </p>
    </section>
  );
}

function FounderLegacyCard({ familyId }: { familyId: string }) {
  const founders = useQuery({
    queryKey: ["founders", familyId],
    queryFn: () => request<Founder[]>(`/v1/families/${familyId}/founders`),
  });
  const list = founders.data ?? [];
  return (
    <section className="legacy-card">
      <CardHead
        icon={<Star size={18} />}
        title="Founder Legacy"
        count={list.length ? String(list.length) : undefined}
      />
      {founders.isLoading ? (
        <p className="legacy-note">Opening the founder archive…</p>
      ) : founders.isError ? (
        <p className="legacy-error" role="alert">
          {founders.error.message}
        </p>
      ) : list.length === 0 ? (
        <div className="legacy-empty">
          <span className="legacy-empty-icon" aria-hidden="true">
            <Star size={22} />
          </span>
          <strong>No legacy profile yet</strong>
          <p>
            Begin a founder&apos;s life, business journey, and counsel in ten chapters, each kept
            with its sources.
          </p>
          <Link href="/app/legacy/founders">Open Founder Legacy Studio →</Link>
        </div>
      ) : (
        <>
          <ul className="legacy-list">
            {list.slice(0, 3).map((founder) => (
              <li key={founder.id}>
                <span className="legacy-avatar" aria-hidden="true">
                  {initials(founder.display_name)}
                </span>
                <div className="legacy-main">
                  <Link className="legacy-title" href={`/app/legacy/founders/${founder.id}`}>
                    {founder.display_name}
                  </Link>
                  <span className="legacy-meta">
                    {founder.title ?? "Family founder"} · {founder.published_count} published
                    {founder.can_edit ? ` · ${founder.draft_count} in draft` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="legacy-note" style={{ marginTop: 14, marginBottom: 0 }}>
            <Link href="/app/legacy/founders">Open Founder Legacy Studio →</Link>
          </p>
        </>
      )}
    </section>
  );
}

function HeritageBookCard() {
  return (
    <section className="legacy-card">
      <CardHead icon={<BookOpen size={18} />} title="Heritage Book Studio" />
      <div className="legacy-empty">
        <span className="legacy-empty-icon" aria-hidden="true">
          <BookOpen size={22} />
        </span>
        <strong>Shape approved stories into a book</strong>
        <p>
          Choose family members, approved stories, photographs, timeline highlights, and founder
          interviews. Every chapter stays editable and needs your approval before a private PDF is
          generated.
        </p>
      </div>
      <p className="legacy-note" style={{ marginTop: 14, marginBottom: 0 }}>
        <Link href="/app/legacy/books">Open Heritage Book Studio →</Link>
      </p>
    </section>
  );
}

function RecentActivityCard({ events }: { events: AuditEvent[] }) {
  return (
    <section className="legacy-card legacy-card--wide">
      <CardHead icon={<Activity size={18} />} title="Your recent activity" />
      <p className="legacy-note">
        Your activity and activity on the items you own. Newer events appear first.
      </p>
      {events.length === 0 ? (
        <div className="legacy-empty">
          <span className="legacy-empty-icon" aria-hidden="true">
            <Activity size={22} />
          </span>
          <strong>No activity yet</strong>
          <p>Recordings, memories, and sharing you take part in will be noted here.</p>
        </div>
      ) : (
        <ul className="legacy-list">
          {events.map((event) => (
            <li key={event.id}>
              <span className="legacy-avatar" aria-hidden="true">
                <Activity size={15} />
              </span>
              <div className="legacy-main">
                <div className="legacy-title">
                  <span style={{ color: "var(--lg-gold)" }}>{humanAction(event.action)}</span>
                </div>
                <div className="legacy-meta">
                  {[event.item_type, shortDate(event.created_at)].filter(Boolean).join(" · ")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
