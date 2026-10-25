export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export interface Account {
  id: number;
  role_arn: string | null;
  external_id: string;
  verified_at: string | null;
}

export interface Finding {
  id: number;
  rule_id: string;
  resource_id: string;
  resource_type: string;
  region: string;
  severity: string;
  title: string;
  description: string;
  savings_monthly: string;
  details: Record<string, unknown>;
}

export interface Scan {
  scan_id: number;
  account_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totals: { findings_count: number; savings_monthly: string };
  findings: Finding[];
  skipped_checks: { rule_id: string; region: string; resource_id?: string | null; reason: string; detail: string }[];
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AIReportResponse {
  scan_id: number;
  ai_summary_unavailable: boolean;
  report: {
    executive_summary: string;
    top_actions: { title: string; why: string; fix_hint: string; finding_ids: number[] }[];
    risks: string[];
  } | null;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status === 401 ? 'Your session expired. Sign out and sign in again.'
      : typeof data?.detail === 'string' ? data.detail : `Request failed (${response.status})`, response.status);
  }
  return data as T;
}

export function money(value: string) {
  return Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
