# Mindful Pause — Lightweight Website Blocker Extension

**Date:** 2026-07-15
**Status:** Approved design, pending implementation plan

## Purpose

A ScreenZen-style mindful-pause tool for websites, built as a Firefox
WebExtension, with near-zero resource usage. Motivated by ScreenZen's high
CPU/memory footprint. Runs in Firefox today and Zen Browser later (Zen is
Firefox-based; the same extension works unchanged).

## Requirements

- **Mindful pause:** navigating to a flagged site shows a pause page (countdown,
  then "open for N minutes" or "never mind") instead of the site.
- **Opens-based budget per site group:** sites are organized into named groups
  (e.g., *Social* = reddit.com, x.com). Each group has a **max number of opens
  per day** and a **max duration per open**. Choosing a duration on the pause
  page consumes one open and starts a wall-clock session for the whole group.
  When opens are exhausted, the group is blocked until the next day. There is
  no cumulative time budget and no usage-time tracking.
- **Wall-clock sessions:** a session lasts its chosen duration in real time
  from the moment it is granted, regardless of tab focus. When it expires,
  any tab still on the group's domains is redirected back to the pause page.
- **Honor system:** the pause is the friction. No anti-bypass machinery.
- **Lightweight is a hard requirement:** no polling loops, no persistent
  background process, no content scripts injected into unflagged pages,
  no focus/tab-time tracking. ~0% CPU when idle.
- Websites only. No desktop-app blocking. Firefox/Zen only.

## Architecture

One WebExtension, three parts:

### 1. Background script (event-driven, non-persistent)

- Listens to `webNavigation.onBeforeNavigate` / `tabs.onUpdated` for top-level
  navigations only.
- On navigation to a flagged domain: if the domain's group has an active
  session window, pass through; otherwise redirect the tab to the internal
  pause page (original URL passed as a query parameter).
- **Session expiry:** one `alarms` alarm per active session, set for the
  session's end time. On firing, find any tabs on the group's domains and
  redirect them to the pause page.
- **Midnight reset:** a daily alarm resets all group open-counts at local
  midnight. Counts also lazily reset on first event of a new day (covers the
  browser being closed at midnight).

### 2. Pause page (internal extension page)

- Shown in place of the flagged site. Displays: group name, opens left today
  (e.g., "3 of 5 opens left"), and a configurable breathing countdown
  (default 10 s) during which buttons are disabled.
- After the countdown: duration buttons from the group's allowance options
  (default 1/5/10/15/30/60 min, filtered to ≤ the group's max minutes per
  open) and "Never mind" (goes back in tab history if there is a previous
  page, otherwise closes the tab).
- Choosing a duration consumes one open, starts a session window for the
  whole group, and navigates to the original URL. Other tabs in the same
  group pass through freely while the session is active; they do not consume
  additional opens.
- If the group's opens are exhausted: no duration buttons, just an "out of
  opens for today" message. (Settings can still raise the limit — honor
  system.)

### 3. Options page

- Manage groups: create, rename, delete.
- Assign domains to groups (each flagged domain belongs to exactly one group;
  a match on `example.com` includes subdomains).
- Per group: max opens per day, max minutes per open, pause countdown
  (seconds), allowance duration options.
- Show opens used today per group.

## Data model

Stored in `storage.local`:

```js
{
  groups: [{
    id, name,
    domains: ["reddit.com", "x.com"],
    maxOpensPerDay: 5,
    maxMinutesPerOpen: 15,
    pauseSeconds: 10,
    allowanceOptions: [1, 5, 10, 15, 30, 60]   // minutes; filtered to ≤ maxMinutesPerOpen
  }],
  state: {
    day: "2026-07-15",              // local date; mismatch triggers lazy reset
    opensUsedByGroup: { [id]: n },
    sessionUntilByGroup: { [id]: epochMs }
  }
}
```

## Error handling

- Malformed/missing storage: fall back to empty config (no sites flagged),
  never break browsing.
- Restricted pages (about:, addons store) can't be intercepted — ignore them.
- The background script is non-persistent; all state lives in
  `storage.local`, so suspension/restart loses nothing. Session-expiry alarms
  persist across background restarts; as a belt-and-braces check, navigation
  handling always compares `sessionUntilByGroup` against the current time
  rather than trusting the alarm alone.
- Computer sleep past a session's end: the alarm fires on wake (or the
  navigation-time check catches it) — either way the expired session does not
  survive.

## Testing

- Unit tests (plain Node, no browser) for the pure logic: domain matching,
  opens arithmetic, day rollover, session-window checks, allowance-option
  filtering.
- Manual verification in Firefox via `about:debugging` temporary add-on load:
  pause flow, session grant and expiry redirect, opens exhaustion,
  midnight/lazy reset, same-group second tab passing through without
  consuming an open.

## Non-goals

- Cumulative time budgets or usage-time tracking, anti-bypass hardening,
  sync across devices/profiles, desktop app blocking, Chrome support,
  usage analytics beyond today's per-group open counts.
