# Mindful Pause — Lightweight Website Blocker Extension

**Date:** 2026-07-15
**Status:** Approved design, pending implementation plan

## Purpose

A ScreenZen-style mindful-pause and daily-time-limit tool for websites, built as a
Firefox WebExtension, with near-zero resource usage. Motivated by ScreenZen's high
CPU/memory footprint. Runs in Firefox today and Zen Browser later (Zen is
Firefox-based; the same extension works unchanged).

## Requirements

- **Mindful pause:** navigating to a flagged site shows a pause page (countdown,
  then "continue for N minutes" or "never mind") instead of the site.
- **Daily time limits per site group:** sites are organized into named groups
  (e.g., *Social* = reddit.com, x.com). Each group shares one daily budget.
  When spent, continue buttons disappear until the next day.
- **Honor system:** the pause is the friction. No anti-bypass machinery.
- **Lightweight is a hard requirement:** no polling loops, no persistent
  background process, no content scripts injected into unflagged pages.
  ~0% CPU when idle.
- Websites only. No desktop-app blocking. Firefox/Zen only.

## Architecture

One WebExtension, three parts:

### 1. Background script (event-driven, non-persistent)

- Listens to `webNavigation.onBeforeNavigate` / `tabs.onUpdated` for top-level
  navigations, `tabs.onActivated`, `windows.onFocusChanged`.
- On navigation to a flagged domain: if the domain's group has an active
  allowance window, pass through; otherwise redirect the tab to the internal
  pause page (original URL passed as a query parameter).
- **Time accrual:** timestamp-delta based, never polling. When the focused,
  active tab enters a flagged domain, record a start timestamp; on tab switch,
  focus loss, navigation away, or window close, add the elapsed delta to the
  group's daily usage. Sleep/lock surfaces as focus loss, so suspended time is
  not counted.
- **No double counting:** usage is wall-clock per group; only the focused,
  active tab accrues. Two same-group tabs visible at once (split view, two
  windows) still accrue only once.
- **Allowance expiry:** a single `alarms` alarm set for the end of the current
  allowance window; on firing, re-check the tab and redirect back to the pause
  page if still on a flagged site.
- **Midnight reset:** a daily alarm resets all group usage counters at local
  midnight. Counters also lazily reset on first event of a new day (covers the
  browser being closed at midnight).

### 2. Pause page (internal extension page)

- Shown in place of the flagged site. Displays: group name, today's usage vs.
  budget, a configurable breathing countdown (default 10 s) during which
  continue buttons are disabled.
- After the countdown: buttons for the group's allowance options (default
  5/10/15 min) and "Never mind" (closes the tab or goes back).
- If the group's budget is spent: no continue buttons, just a "budget spent
  for today" message. (Settings can still raise the limit — honor system.)
- Choosing an allowance opens an allowance window for the whole group and
  navigates to the original URL.

### 3. Options page

- Manage groups: create, rename, delete.
- Assign domains to groups (each flagged domain belongs to exactly one group;
  a match on `example.com` includes subdomains).
- Per group: daily limit (minutes), pause countdown (seconds), allowance
  durations.
- Show today's usage per group.

## Data model

Stored in `storage.local`:

```js
{
  groups: [{
    id, name,
    domains: ["reddit.com", "x.com"],
    dailyLimitMinutes: 30,
    pauseSeconds: 10,
    allowanceOptions: [5, 10, 15]   // minutes
  }],
  state: {
    day: "2026-07-15",              // local date; mismatch triggers lazy reset
    usageSecondsByGroup: { [id]: n },
    allowanceUntilByGroup: { [id]: epochMs }
  }
}
```

## Error handling

- Malformed/missing storage: fall back to empty config (no sites flagged),
  never break browsing.
- Restricted pages (about:, addons store) can't be intercepted — ignore them.
- If the background script is suspended and restarted (non-persistent), all
  state needed to resume lives in `storage.local`; in-memory state is limited
  to the current accrual start timestamp, which is also checkpointed to
  storage on write-worthy events so a restart loses at most the current
  in-progress interval.

## Testing

- Unit tests (plain Node, no browser) for the pure logic: domain matching,
  budget arithmetic, day rollover, allowance-window checks.
- Manual verification in Firefox via `about:debugging` temporary add-on load:
  pause flow, allowance flow, budget exhaustion, midnight/lazy reset, no
  accrual while unfocused.

## Non-goals

- Anti-bypass hardening, sync across devices/profiles, desktop app blocking,
  Chrome support, usage analytics/charts beyond today's per-group totals.
