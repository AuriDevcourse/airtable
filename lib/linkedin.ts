// One shared cleaner for the LinkedIn fields across every feed. The source fields are
// free text filled by partners on phones, so real submissions arrive as:
//   https://www.linkedin.com/in/x   (fine)
//   www.linkedin.com/in/x           (no scheme → rendered as a relative link, broken)
//   linkedin.com/in/x, dk.linkedin.com/in/x, lnkd.in/xyz (no scheme)
//   https://i.linkedin.com/in/x, m.linkedin.com/in/x (mobile hosts that 404 on desktop)
// A bare startsWith("http") guard silently DROPS everything but the first shape, which
// is why some cards rendered unlinked. Normalize instead of reject.
export function normalizeLinkedInUrl(v: unknown): string | null {
  let s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;

  // Scheme-less URLs: anything that is recognizably LinkedIn, or any www. address.
  if (!/^https?:\/\//i.test(s)) {
    const linkedInish = /^(?:[a-z0-9-]+\.)*(?:linkedin\.com|lnkd\.in)\//i.test(s);
    if (!linkedInish && !/^www\./i.test(s)) return null;
    s = "https://" + s.replace(/^\/+/, "");
  }

  // Mobile/app hosts don't resolve in a desktop browser — swap them for www.
  s = s.replace(/^(https?:\/\/)(?:i|m|touch)\.(linkedin\.com)/i, "$1www.$2");

  return s;
}
