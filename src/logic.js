// Pure logic for Mindful Pause. No browser APIs — unit-testable in plain Node.

export function hostMatchesDomain(host, domain) {
  host = host.toLowerCase();
  domain = domain.toLowerCase();
  return host === domain || host.endsWith("." + domain);
}

export function findGroupForUrl(urlString, groups) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  for (const group of groups) {
    if (group.domains.some((d) => hostMatchesDomain(url.hostname, d))) {
      return group;
    }
  }
  return null;
}

export function normalizeDomain(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0];
}

export function localDayString(epochMs) {
  const d = new Date(epochMs);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function freshState(now) {
  return { day: localDayString(now), opensUsedByGroup: {}, sessionUntilByGroup: {} };
}

export function ensureDay(state, now) {
  if (!state || state.day !== localDayString(now)) return freshState(now);
  return state;
}
