export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export const GOOGLE_LOGIN_URL = `${API_URL}/api/auth/google/login`;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  provider: "password" | "google";
  picture?: string | null;
  locale?: string;
  advanced_mode?: boolean;
  feature_heritage?: boolean;
};

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? typeof (data as { detail: unknown }).detail === "string"
          ? String((data as { detail: unknown }).detail)
          : "Check the form fields and try again."
        : `Request failed (${response.status})`;
    const structured =
      data && typeof data === "object" && "detail" in data
        ? (data as { detail: unknown }).detail
        : null;
    const error = new ApiError(
      response.status,
      structured && typeof structured === "object" && "message" in structured
        ? String(structured.message)
        : detail,
    );
    if (structured && typeof structured === "object" && "code" in structured)
      error.code = String(structured.code);
    throw error;
  }
  return data as T;
}

const apiFetch = (path: string, options: RequestInit = {}) => request<AuthUser>(path, options);

export function signup(input: { name: string; email: string; password: string }) {
  return apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }) {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout() {
  await apiFetch("/api/auth/logout", { method: "POST" });
}

export async function me(): Promise<AuthUser | null> {
  try {
    return await apiFetch("/api/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
