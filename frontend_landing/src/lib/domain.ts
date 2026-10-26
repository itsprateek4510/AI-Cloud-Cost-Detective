export type Space = {
  id: string;
  name: string;
  type: "personal" | "family" | "circle";
  family_id: string | null;
  owner_user_id: string | null;
};
export type Family = { id: string; name: string; created_at?: string };
export type Person = {
  id: string;
  display_name: string;
  family_id: string;
  linked_user_id: string | null;
  birth_year: number | null;
  is_deceased: boolean;
};
export type Member = { id: string; name: string; role: string };
export type Source = {
  id: string;
  source_type: "message" | "recording";
  source_id: string;
  quote: string;
  start_ms: number | null;
  end_ms: number | null;
};
export type Memory = {
  id: string;
  space_id: string;
  summary: string;
  kind: string;
  status: string;
  owner_user_id: string;
  owner_name: string;
  subject_name: string | null;
  sensitivity: string;
  level: string;
  access_reason: string;
  version: number;
  pinned: boolean;
  sources: Source[];
  source_count: number;
  as_of_date: string | null;
  created_at: string;
};
export type AuditEvent = {
  id: string;
  actor_user_id: string;
  action: string;
  item_type: string;
  item_id: string;
  owner_user_id: string;
  meta: Record<string, unknown>;
  created_at: string;
};
export type Grant = {
  id: string;
  grantee_type: string;
  grantee_ref: string;
  level: string;
  revoked_at: string | null;
  release_at: string | null;
  expires_at: string | null;
};
export type Recording = {
  id: string;
  title: string;
  status: string;
  duration: number | null;
  error: string | null;
  followups: string[];
  space_id: string;
  owner_user_id: string;
  upload_token?: string;
  level?: string;
  created_at?: string;
  auto_extract?: boolean;
  subject_person_id?: string | null;
};

export type InterviewTheme = { key: string; label: string; questions: string[] };
export type Interview = {
  id: string;
  title: string;
  theme: string;
  theme_label: string;
  family_id: string;
  subject_person_id: string;
  subject_name: string;
  space_id: string;
  created_at: string;
  updated_at: string;
};
export type InterviewDetail = Interview & {
  questions: string[];
  responses: {
    id: string;
    available: boolean;
    question: string | null;
    recording_id: string | null;
    title: string | null;
    status: string | null;
  }[];
  summary: string | null;
  summary_withheld: boolean;
  source_fingerprint: string | null;
  sources_available: boolean;
};
export type InterviewCandidate = { segment_id: string; quote: string; summary: string };
export type InterviewAssistance = {
  summary: string;
  source_fingerprint: string;
  followups: string[];
  candidates: InterviewCandidate[];
  draft: boolean;
};
export type Segment = {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  edited_text: string | null;
  speaker_person_id?: string | null;
};
export type Thread = { id: string; title: string; incognito: boolean; owner_user_id: string };
export type Citation = {
  number: number;
  memory_id: string;
  summary: string;
  level: string;
  reason: string;
};
export type Message = {
  id: string;
  body: string;
  author_user_id: string | null;
  citations: Citation[];
  suggested_memory_ids?: string[];
};
export type Answer = {
  answer: string;
  verified: boolean;
  citations: Citation[];
  private_answer_available: boolean;
  conversation_id?: string | null;
};
export type MemorySettings = {
  hints_mode: "off" | "ask" | "auto_safe";
  remember_chats: boolean;
  retention_days: number;
  incognito_default: boolean;
  weekly_prompts: boolean;
  quiet_start: number;
  quiet_end: number;
  prompts_paused_until: string | null;
};

export type HomeChecklistItem = {
  key: "story" | "family" | "invite" | "weekly" | string;
  label: string;
  done: boolean;
  href: string;
};

export type HomeNextAction = {
  kind: "story" | "family" | "hint" | "suggestion" | "weekly_question" | string;
  label: string;
  detail: string;
  cta: string;
  href: string;
};

export type HomePerson = {
  person_id: string;
  name: string;
  relation_label: string;
  on_smriti: boolean;
};

export type HomeStory = {
  id: string;
  summary: string;
  subject_name: string | null;
  owner_name: string | null;
  created_at: string;
  href: string;
};

export type HomeSummary = {
  greeting_name: string;
  checklist: HomeChecklistItem[];
  next_action: HomeNextAction;
  pending: {
    memory_suggestions: number;
    hints: number;
    share_invites: number;
  };
  family: HomePerson[];
  weekly_question: { id: string | null; text: string };
  recent_stories: HomeStory[];
};

export type FounderSource = {
  id: string;
  available: boolean;
  kind: "memory" | "recording" | null;
  item_id: string | null;
  label: string | null;
  quote: string | null;
  level: string | null;
};

export type FounderSection = {
  section: string;
  label: string;
  status: "empty" | "draft" | "published" | string;
  version: number;
  ai_assisted: boolean;
  ai_notes: {
    used_source_ids?: string[];
    unverified?: string[];
    generated_at?: string;
    model?: string;
    instructions?: string;
  };
  updated_at: string | null;
  published_at: string | null;
  published_by_name: string | null;
  source_count: number;
  withheld: boolean;
  narrative: string | null;
  sources: FounderSource[];
};

export type Founder = {
  id: string;
  family_id: string;
  person_id: string | null;
  display_name: string;
  title: string | null;
  birth_year: number | null;
  summary: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  person_name: string | null;
  published_count: number;
  draft_count: number;
  total_sections: number;
};

export type FounderDetail = Omit<Founder, "published_count" | "draft_count" | "total_sections"> & {
  sections: FounderSection[];
};

export type AvailableSources = {
  memories: {
    id: string;
    kind: "memory";
    summary: string;
    subject_name: string | null;
    level: string;
    created_at: string;
  }[];
  recordings: {
    id: string;
    kind: "recording";
    title: string;
    status: string;
    duration: number | null;
    has_transcript: boolean;
    created_at: string;
  }[];
};

export type TimelineSource = FounderSource;

export type TimelineEvent = {
  id: string;
  family_id: string;
  person_id: string | null;
  person_name: string | null;
  person_generation: number | null;
  category: string;
  category_label: string;
  title: string;
  description: string | null;
  occurred_on: string | null;
  date_note: string | null;
  created_at: string;
  created_by_name: string | null;
  updated_at: string;
  updated_by_name: string | null;
  can_edit: boolean;
  source_count: number;
  sources: TimelineSource[];
};

export type TimelinePerson = {
  id: string;
  name: string;
  birth_year: number | null;
  is_deceased: boolean;
  generation: number | null;
};

export type TimelinePayload = {
  events: TimelineEvent[];
  persons: TimelinePerson[];
  categories: { key: string; label: string }[];
  can_edit: boolean;
};

export function time(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type VaultCollection = {
  id: string;
  family_id: string;
  parent_id: string | null;
  root_id: string;
  name: string;
  description: string | null;
  visibility: "private" | "family";
  can_manage: boolean;
  created_at: string;
};
export type VaultFile = {
  id: string;
  collection_id: string;
  title: string;
  description?: string | null;
  person_id?: string | null;
  person_name?: string | null;
  occurred_on?: string | null;
  category?: string;
  filename?: string | null;
  media_type?: string | null;
  size_bytes?: number | null;
  status: "pending" | "ready" | "revoked";
  created_at?: string;
  recording_id?: string | null;
  scanned?: boolean;
  can_manage: boolean;
  download_original?: boolean;
};
export type VaultPayload = {
  collections: VaultCollection[];
  files: VaultFile[];
  capabilities: {
    upload_enabled: boolean;
    storage_error: string | null;
    development_storage: boolean;
    max_bytes: number;
    file_types: Record<string, string>;
    categories: string[];
    video_enabled: boolean;
    search_mode: string;
  };
};
export type VaultConsent = { id: string; revoked_at: string | null; label: string; owner: boolean };

export type LegacyCitation = {
  number: number;
  memory_id: string;
  summary: string;
  level: string;
  reason: string;
  version: number;
  access_version: number;
  kind: string;
  as_of_date: string | null;
  subject_name: string | null;
};

export type LegacyAnswer = {
  family_id: string;
  answer: string;
  citations: LegacyCitation[];
  verified: boolean;
  refusal: boolean;
};

export type BookTemplate = "classic_heritage" | "modern_legacy" | "founder_biography";
export type BookChapterKind =
  | "introduction"
  | "chapter"
  | "timeline"
  | "photographs"
  | "founder"
  | "values";

export type BookSource = {
  id: string;
  kind: "memory" | "recording" | "photograph" | "timeline" | "founder" | "interview";
  available: boolean;
  label: string;
  description?: string | null;
  subject_name?: string | null;
  filename?: string | null;
  media_type?: string | null;
  occurred_on?: string | null;
  date_note?: string | null;
  status?: string;
  title?: string | null;
  birth_year?: number | null;
  theme?: string;
};

export type BookChapter = {
  id: string;
  book_id: string;
  position: number;
  kind: BookChapterKind;
  kind_label: string;
  title: string;
  body: string | null;
  status: "draft" | "approved";
  source_fingerprint: string | null;
  memory_ids: string[];
  recording_ids: string[];
  vault_file_ids: string[];
  timeline_event_ids: string[];
  founder_ids: string[];
  interview_ids: string[];
  ai_assisted: boolean;
  approved_at: string | null;
  approved_by_name: string | null;
  version: number;
  updated_at: string;
  sources: {
    memories: BookSource[];
    recordings: BookSource[];
    photographs: BookSource[];
    timeline: BookSource[];
    founders: BookSource[];
    interviews: BookSource[];
  };
  source_errors: string[];
  ready: boolean;
  blocked_reason: string | null;
};

export type HeritageBook = {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  subtitle: string | null;
  template: BookTemplate;
  template_label: string;
  audience_user_ids: string[];
  person_ids: string[];
  audience: { id: string; name: string }[];
  persons: { id: string; name: string }[];
  status: "draft" | "approved";
  version: number;
  approved_at: string | null;
  approved_by: string | null;
  updated_at: string;
  chapter_count: number;
  can_export: boolean;
  chapters: BookChapter[];
  export: {
    ready: boolean;
    generated_at: string | null;
    sha256: string | null;
    filename: string;
  };
};

export type BookSummary = {
  id: string;
  title: string;
  subtitle: string | null;
  template: BookTemplate;
  template_label: string;
  status: "draft" | "approved";
  chapter_count: number;
  export_ready: boolean;
  updated_at: string;
};

export type BookSources = {
  audience: { id: string; name: string }[];
  memories: {
    id: string;
    summary: string;
    subject_name: string | null;
    kind_label: string;
    created_at: string;
  }[];
  recordings: {
    id: string;
    title: string;
    status: string;
    duration: number | null;
    has_transcript: boolean;
    transcript_authorized: boolean;
    created_at: string;
  }[];
  photographs: {
    id: string;
    title: string;
    description: string | null;
    filename: string | null;
    media_type: string | null;
    occurred_on: string | null;
    person_name: string | null;
  }[];
  timeline: {
    id: string;
    title: string;
    description: string | null;
    occurred_on: string | null;
    date_note: string | null;
    category: string;
  }[];
  founders: {
    id: string;
    display_name: string;
    title: string | null;
    birth_year: number | null;
    summary: string | null;
    published_chapters: { section: string; label: string }[];
  }[];
  interviews: {
    id: string;
    title: string;
    subject_name: string | null;
    theme: string;
    summary: string;
  }[];
  private_interviews_allowed: boolean;
};
