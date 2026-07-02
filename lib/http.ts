// fetch with a hard timeout so a hung Airtable/Supabase request fails fast instead of
// risking the Vercel function timeout. On timeout the returned promise rejects (AbortError),
// which the caller's try/catch turns into a normal error path (and cached() serves stale).

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
