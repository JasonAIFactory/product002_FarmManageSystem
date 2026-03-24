/**
 * Farmer API client — talks to the FastAPI backend.
 *
 * All requests include the JWT token from localStorage.
 * The base URL switches between local dev and production.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("farmer_token");
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE}/api/v1${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  console.log(`[farmerApi] ${options.method || "GET"} ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    // Network error — backend is down or CORS blocked
    const message = err instanceof Error ? err.message : "알 수 없는 네트워크 오류";
    console.error(`[farmerApi] NETWORK ERROR: ${options.method || "GET"} ${url}`, err);
    throw new Error(`서버 연결 실패 (${API_BASE}): ${message}`);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error(`[farmerApi] HTTP ${res.status}: ${options.method || "GET"} ${url}`, errorBody);
    try {
      const error = JSON.parse(errorBody);
      throw new Error(error.error?.message || error.detail?.message || error.detail || `HTTP ${res.status}`);
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(`서버 오류 (HTTP ${res.status}): ${errorBody.slice(0, 200)}`);
      }
      throw parseErr;
    }
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Auth ---

export async function getKakaoLoginUrl(): Promise<string> {
  const data = await apiFetch<{ login_url: string }>("/auth/kakao/login");
  return data.login_url;
}

export async function loginWithKakao(code: string): Promise<string> {
  const data = await apiFetch<{ access_token: string }>("/auth/kakao", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  localStorage.setItem("farmer_token", data.access_token);
  return data.access_token;
}

export async function getMyProfile(): Promise<{
  id: string;
  nickname: string | null;
  profile_image_url: string | null;
  role: string;
}> {
  return apiFetch("/auth/me");
}

export function logout(): void {
  localStorage.removeItem("farmer_token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// --- Voice ---

export async function uploadVoice(audioBlob: Blob): Promise<{
  id: string;
  status: string;
  message: string;
}> {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  return apiFetch("/voice/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getVoiceResult(id: string): Promise<{
  id: string;
  status: string;
  transcript: string | null;
  parsed_data: ParsedFarmLog | null;
  created_at: string;
}> {
  return apiFetch(`/voice/${id}/result`);
}

// --- Farm Logs ---

export interface ParsedFarmLog {
  date: string;
  field_names: string[];
  crop: string;
  tasks: { stage: string; detail: string | null; duration_hours: number | null }[];
  chemicals: { type: string; name: string; amount: string | null; action: string }[];
  weather_farmer: string | null;
  notes: string | null;
}

export interface FarmLog {
  id: string;
  log_date: string;
  status: string;
  crop: string;
  tasks: { id: string; field_name: string | null; stage: string; detail: string | null; duration_hours: number | null }[];
  chemicals: { id: string; type: string; name: string; amount: string | null; action: string }[];
  weather_official: Record<string, unknown> | null;
  weather_farmer: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function createFarmLog(data: {
  voice_recording_id?: string;
  log_date: string;
  crop?: string;
  tasks: { field_name?: string; stage: string; detail?: string; duration_hours?: number }[];
  chemicals?: { type: string; name: string; amount?: string; action?: string }[];
  weather_farmer?: string;
  notes?: string;
}): Promise<FarmLog> {
  return apiFetch("/farm-logs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listFarmLogs(dateFrom?: string, dateTo?: string): Promise<{
  logs: FarmLog[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return apiFetch(`/farm-logs${qs ? `?${qs}` : ""}`);
}

export async function confirmFarmLog(id: string): Promise<FarmLog> {
  return apiFetch(`/farm-logs/${id}/confirm`, { method: "PUT" });
}

export async function deleteFarmLog(id: string): Promise<void> {
  return apiFetch(`/farm-logs/${id}`, { method: "DELETE" });
}

// --- Export ---

export function getExportUrl(dateFrom: string, dateTo: string): string {
  const token = getToken();
  return `${API_BASE}/api/v1/export/farm-diary?date_from=${dateFrom}&date_to=${dateTo}&token=${token}`;
}
