# Mindful Pause Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Firefox/Zen WebExtension that shows a mindful pause page before flagged sites, with per-site-group opens-per-day tracking and optional strict blocking — near-zero idle resource usage.

**Architecture:** One Manifest V3 WebExtension with an event-driven, non-persistent background script (no polling, no content scripts). Pure decision logic lives in `src/logic.js` (no browser APIs) so it is unit-testable in plain Node; `background.js` is thin glue wiring browser events to that logic. UI is two static extension pages (pause page, options page).

**Tech Stack:** Vanilla JS (ES modules), WebExtension APIs (`webNavigation`, `tabs`, `storage`, `alarms`), Node built-in test runner (`node --test`) — zero dependencies.

**Spec:** `docs/superpowers/specs/2026-07-15-mindful-pause-extension-design.md`

## File structure

```
manifest.json            — MV3 manifest (Firefox event-page background)
background.js            — event glue: navigation intercept, messages, alarms
src/logic.js             — pure logic: domain match, day rollover, opens/sessions
pause/pause.html|js|css  — the mindful pause page
options/options.html|js|css — group management UI
test/logic.test.js       — Node unit tests for src/logic.js
package.json, .gitignore, README.md
```

Domain knowledge for the implementer:

- **Firefox loads unpacked extensions** via `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on…" → pick `manifest.json`. Reload after each change with the "Reload" button there. Zen Browser works identically.
- **`browser.*` APIs return Promises in Firefox** (no callbacks needed, no polyfill needed). An `async` function passed to `browser.runtime.onMessage.addListener` may return a Promise; the resolved value becomes the sender's response.
- **Background is non-persistent:** never keep required state in module-level variables; always read/write `browser.storage.local`.
- A brief flash of the target site before the redirect is acceptable (the spec's honor-system stance; ScreenZen behaves the same).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `.gitignore`, `manifest.json`, `background.js` (stub), `src/logic.js` (empty module), `test/logic.test.js` (empty)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mindful-pause",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
web-ext-artifacts/
*.zip
```

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Mindful Pause",
  "version": "0.1.0",
  "description": "Mindful pause and opens-per-day limits for distracting websites. Event-driven, near-zero resource usage.",
  "browser_specific_settings": {
    "gecko": {
      "id": "mindful-pause@jyuc",
      "strict_min_version": "115.0"
    }
  },
  "permissions": ["webNavigation", "tabs", "storage", "alarms"],
  "background": {
    "scripts": ["background.js"],
    "type": "module"
  },
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  }
}
```

- [ ] **Step 4: Create stub `background.js`**

```js
// Event glue for Mindful Pause. All decision logic lives in src/logic.js.
console.log("Mindful Pause background loaded");
```

- [ ] **Step 5: Create empty `src/logic.js`**

```js
// Pure logic for Mindful Pause. No browser APIs — unit-testable in plain Node.
```

- [ ] **Step 6: Create empty `test/logic.test.js`**

```js
import { test } from "node:test";
```

- [ ] **Step 7: Verify test runner works**

Run: `npm test`
Expected: exits 0, reports `tests 0` (or `pass 0`).

- [ ] **Step 8: Verify the extension loads in Firefox**

Open Firefox → `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on…" → select `manifest.json`. Expected: "Mindful Pause" appears with no manifest errors; its console (Inspect) shows `Mindful Pause background loaded`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold MV3 extension and node test runner"
```

---

### Task 2: URL/domain matching logic (TDD)

**Files:**
- Modify: `src/logic.js`
- Test: `test/logic.test.js`

- [ ] **Step 1: Write failing tests**

Replace `test/logic.test.js` with:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const social = {
  id: "g1",
  name: "Social",
  domains: ["reddit.com", "x.com"],
  maxOpensPerDay: 5,
  maxMinutesPerOpen: 15,
  strictBlocking: false,
  pauseSeconds: 10,
  allowanceOptions: [1, 5, 10, 15, 30, 60],
};

test("hostMatchesDomain: exact and subdomain match, no suffix tricks", () => {
  assert.equal(L.hostMatchesDomain("reddit.com", "reddit.com"), true);
  assert.equal(L.hostMatchesDomain("old.reddit.com", "reddit.com"), true);
  assert.equal(L.hostMatchesDomain("REDDIT.com", "reddit.com"), true);
  assert.equal(L.hostMatchesDomain("notreddit.com", "reddit.com"), false);
  assert.equal(L.hostMatchesDomain("reddit.com.evil.io", "reddit.com"), false);
});

test("findGroupForUrl: matches http(s) URLs to a group", () => {
  assert.equal(L.findGroupForUrl("https://old.reddit.com/r/all", [social]), social);
  assert.equal(L.findGroupForUrl("https://x.com/home", [social]), social);
  assert.equal(L.findGroupForUrl("https://example.com/", [social]), null);
});

test("findGroupForUrl: ignores non-http and malformed URLs", () => {
  assert.equal(L.findGroupForUrl("about:blank", [social]), null);
  assert.equal(L.findGroupForUrl("moz-extension://abc/pause.html", [social]), null);
  assert.equal(L.findGroupForUrl("not a url", [social]), null);
});

test("normalizeDomain: strips scheme, path, whitespace, case", () => {
  assert.equal(L.normalizeDomain("  https://WWW.YouTube.com/watch?v=1 "), "www.youtube.com");
  assert.equal(L.normalizeDomain("reddit.com/r/all"), "reddit.com");
  assert.equal(L.normalizeDomain("x.com"), "x.com");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `L.hostMatchesDomain is not a function` (and similar).

- [ ] **Step 3: Implement in `src/logic.js`**

Append:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic.js test/logic.test.js
git commit -m "feat: domain matching and normalization logic"
```

---

### Task 3: Day rollover and state logic (TDD)

**Files:**
- Modify: `src/logic.js`
- Test: `test/logic.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/logic.test.js`:

```js
test("localDayString: local date as YYYY-MM-DD", () => {
  const d = new Date(2026, 6, 15, 23, 59).getTime(); // July 15 2026, local
  assert.equal(L.localDayString(d), "2026-07-15");
});

test("ensureDay: keeps state for same day, resets on new day or missing", () => {
  const now = new Date(2026, 6, 15, 12, 0).getTime();
  const state = {
    day: "2026-07-15",
    opensUsedByGroup: { g1: 3 },
    sessionUntilByGroup: { g1: now + 60000 },
  };
  assert.equal(L.ensureDay(state, now), state);

  const nextDay = new Date(2026, 6, 16, 0, 1).getTime();
  const reset = L.ensureDay(state, nextDay);
  assert.deepEqual(reset, {
    day: "2026-07-16",
    opensUsedByGroup: {},
    sessionUntilByGroup: {},
  });

  assert.deepEqual(L.ensureDay(null, now), {
    day: "2026-07-15",
    opensUsedByGroup: {},
    sessionUntilByGroup: {},
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `L.localDayString is not a function`.

- [ ] **Step 3: Implement in `src/logic.js`**

Append:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic.js test/logic.test.js
git commit -m "feat: day rollover state logic"
```

---

### Task 4: Opens, sessions, and blocking logic (TDD)

**Files:**
- Modify: `src/logic.js`
- Test: `test/logic.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/logic.test.js` (reuses `social` from Task 2):

```js
test("opensUsed and hasActiveSession defaults", () => {
  const now = Date.now();
  const state = L.freshState(now);
  assert.equal(L.opensUsed(state, "g1"), 0);
  assert.equal(L.hasActiveSession(state, "g1", now), false);
});

test("grantOpen: increments opens, sets wall-clock session end", () => {
  const now = 1_000_000;
  const s1 = L.grantOpen(L.freshState(now), social, 10, now);
  assert.equal(L.opensUsed(s1, "g1"), 1);
  assert.equal(s1.sessionUntilByGroup.g1, now + 10 * 60_000);
  assert.equal(L.hasActiveSession(s1, "g1", now + 9 * 60_000), true);
  assert.equal(L.hasActiveSession(s1, "g1", now + 10 * 60_000), false);
});

test("grantOpen: clamps duration to maxMinutesPerOpen", () => {
  const now = 0;
  const s1 = L.grantOpen(L.freshState(now), social, 60, now);
  assert.equal(s1.sessionUntilByGroup.g1, 15 * 60_000);
});

test("isBlocked: only when strictBlocking and opens exhausted", () => {
  const now = 0;
  let state = L.freshState(now);
  for (let i = 0; i < 5; i++) state = L.grantOpen(state, social, 1, now);
  assert.equal(L.isBlocked(social, state), false); // default: informational only
  const strict = { ...social, strictBlocking: true };
  assert.equal(L.isBlocked(strict, state), true);
  assert.equal(L.isBlocked(strict, L.freshState(now)), false);
});

test("allowanceChoices: filtered to maxMinutesPerOpen", () => {
  assert.deepEqual(L.allowanceChoices(social), [1, 5, 10, 15]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `L.opensUsed is not a function`.

- [ ] **Step 3: Implement in `src/logic.js`**

Append:

```js
export function opensUsed(state, groupId) {
  return state.opensUsedByGroup[groupId] ?? 0;
}

export function hasActiveSession(state, groupId, now) {
  return (state.sessionUntilByGroup[groupId] ?? 0) > now;
}

export function isBlocked(group, state) {
  return !!group.strictBlocking && opensUsed(state, group.id) >= group.maxOpensPerDay;
}

export function allowanceChoices(group) {
  return group.allowanceOptions.filter((m) => m <= group.maxMinutesPerOpen);
}

export function grantOpen(state, group, minutes, now) {
  const chosen = Math.min(minutes, group.maxMinutesPerOpen);
  return {
    ...state,
    opensUsedByGroup: {
      ...state.opensUsedByGroup,
      [group.id]: opensUsed(state, group.id) + 1,
    },
    sessionUntilByGroup: {
      ...state.sessionUntilByGroup,
      [group.id]: now + chosen * 60_000,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic.js test/logic.test.js
git commit -m "feat: opens, sessions, and strict-blocking logic"
```

---

### Task 5: Background script

**Files:**
- Modify: `background.js` (replace stub)

No Node unit tests here — this file is pure browser glue over the already-tested logic. Verification is manual (Step 2).

- [ ] **Step 1: Replace `background.js`**

```js
// Event glue for Mindful Pause. All decision logic lives in src/logic.js.
// Non-persistent: no required state in module variables; storage.local is truth.
import * as L from "./src/logic.js";

const PAUSE_PATH = "/pause/pause.html";

async function getConfig() {
  const data = await browser.storage.local.get({ groups: [], state: null });
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const state = L.ensureDay(data.state, Date.now());
  return { groups, state };
}

async function saveState(state) {
  await browser.storage.local.set({ state });
}

function pauseUrl(groupId, targetUrl) {
  return (
    browser.runtime.getURL(PAUSE_PATH) +
    `?group=${encodeURIComponent(groupId)}&target=${encodeURIComponent(targetUrl)}`
  );
}

browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const { groups, state } = await getConfig();
  const group = L.findGroupForUrl(details.url, groups);
  if (!group) return;
  if (L.hasActiveSession(state, group.id, Date.now())) return;
  await saveState(state); // persist lazy day-reset, if one happened
  try {
    await browser.tabs.update(details.tabId, {
      url: pauseUrl(group.id, details.url),
    });
  } catch {
    // tab already gone — nothing to do
  }
});

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "get-pause-info") {
    const { groups, state } = await getConfig();
    const group = groups.find((g) => g.id === msg.groupId) ?? null;
    return {
      group,
      opensUsed: group ? L.opensUsed(state, group.id) : 0,
      blocked: group ? L.isBlocked(group, state) : false,
      choices: group ? L.allowanceChoices(group) : [],
    };
  }
  if (msg.type === "grant-open") {
    const { groups, state } = await getConfig();
    const group = groups.find((g) => g.id === msg.groupId);
    if (!group || L.isBlocked(group, state)) return { ok: false };
    const next = L.grantOpen(state, group, msg.minutes, Date.now());
    await saveState(next);
    await browser.alarms.create(`session:${group.id}`, {
      when: next.sessionUntilByGroup[group.id],
    });
    return { ok: true };
  }
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith("session:")) {
    const groupId = alarm.name.slice("session:".length);
    const { groups, state } = await getConfig();
    const group = groups.find((g) => g.id === groupId);
    // Belt and braces: never trust the alarm alone — re-check the clock.
    if (!group || L.hasActiveSession(state, groupId, Date.now())) return;
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && L.findGroupForUrl(tab.url, [group])) {
        try {
          await browser.tabs.update(tab.id, { url: pauseUrl(group.id, tab.url) });
        } catch {
          // tab closed mid-iteration — skip
        }
      }
    }
  }
  if (alarm.name === "midnight") {
    const { state } = await getConfig(); // ensureDay already reset it
    await saveState(state);
    scheduleMidnight();
  }
});

function scheduleMidnight() {
  const next = new Date();
  next.setHours(24, 0, 5, 0); // 00:00:05 local, tomorrow
  browser.alarms.create("midnight", { when: next.getTime() });
}

browser.runtime.onInstalled.addListener(scheduleMidnight);
browser.runtime.onStartup.addListener(scheduleMidnight);
```

- [ ] **Step 2: Manual smoke test**

Reload the extension in `about:debugging`. In the extension's Inspect console, seed a test config:

```js
await browser.storage.local.set({ groups: [{
  id: "g1", name: "Social", domains: ["reddit.com"],
  maxOpensPerDay: 5, maxMinutesPerOpen: 15, strictBlocking: false,
  pauseSeconds: 3, allowanceOptions: [1, 5, 10, 15, 30, 60]
}]});
```

Navigate a tab to `https://reddit.com`. Expected: tab lands on a `moz-extension://…/pause/pause.html?group=g1&target=…` URL (404/blank page is fine — the page doesn't exist until Task 6). Navigating to `https://example.com` is untouched.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "feat: background navigation intercept, sessions, alarms"
```

---

### Task 6: Pause page

**Files:**
- Create: `pause/pause.html`, `pause/pause.js`, `pause/pause.css`

- [ ] **Step 1: Create `pause/pause.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Take a breath</title>
  <link rel="stylesheet" href="pause.css" />
</head>
<body>
  <main>
    <p class="eyebrow">Mindful Pause</p>
    <h1 id="group-name">…</h1>
    <p id="opens-line"></p>
    <div id="countdown" aria-live="polite"></div>
    <p id="overage" class="overage" hidden></p>
    <div id="buttons" hidden>
      <div id="choices"></div>
      <button id="never-mind" class="secondary">Never mind</button>
    </div>
  </main>
  <script type="module" src="pause.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `pause/pause.css`**

```css
:root { color-scheme: light dark; }
body {
  margin: 0; min-height: 100vh; display: grid; place-items: center;
  font-family: system-ui, sans-serif;
  background: light-dark(#f3f1ec, #1c1b1a); color: light-dark(#2b2a28, #e8e6e1);
}
main { text-align: center; max-width: 26rem; padding: 2rem; }
.eyebrow { text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.7rem; opacity: 0.6; }
h1 { font-weight: 600; margin: 0.25rem 0 0.5rem; }
#opens-line { opacity: 0.75; }
#countdown { font-size: 3.5rem; font-variant-numeric: tabular-nums; margin: 1.5rem 0; }
.overage { color: light-dark(#a05a00, #e8a24c); font-weight: 500; }
#choices { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-bottom: 1rem; }
button {
  font: inherit; padding: 0.5rem 1.1rem; border-radius: 999px; cursor: pointer;
  border: 1px solid light-dark(#c9c4ba, #4a4844);
  background: light-dark(#fff, #2a2927); color: inherit;
}
button:hover { border-color: light-dark(#8a857c, #7a766f); }
button.secondary { background: transparent; opacity: 0.7; }
```

- [ ] **Step 3: Create `pause/pause.js`**

```js
const params = new URLSearchParams(location.search);
const groupId = params.get("group");
const target = params.get("target") ?? "";

const groupNameEl = document.getElementById("group-name");
const opensLineEl = document.getElementById("opens-line");
const countdownEl = document.getElementById("countdown");
const overageEl = document.getElementById("overage");
const buttonsEl = document.getElementById("buttons");
const choicesEl = document.getElementById("choices");

document.getElementById("never-mind").addEventListener("click", neverMind);

init();

async function init() {
  const info = await browser.runtime.sendMessage({ type: "get-pause-info", groupId });
  if (!info || !info.group) {
    // Group was deleted — never trap the user on this page.
    location.href = target || "about:blank";
    return;
  }
  const g = info.group;
  groupNameEl.textContent = g.name;
  opensLineEl.textContent =
    `${Math.max(0, g.maxOpensPerDay - info.opensUsed)} of ${g.maxOpensPerDay} opens left today`;

  let remaining = g.pauseSeconds;
  countdownEl.textContent = remaining;
  const timer = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      countdownEl.textContent = remaining;
      return;
    }
    clearInterval(timer);
    countdownEl.textContent = "•";
    showChoices(info, g);
  }, 1000);
}

function showChoices(info, g) {
  buttonsEl.hidden = false;
  if (info.blocked) {
    overageEl.textContent = "Out of opens for today.";
    overageEl.hidden = false;
    return; // strict mode: no continue buttons
  }
  if (info.opensUsed >= g.maxOpensPerDay) {
    overageEl.textContent =
      `You're past your ${g.maxOpensPerDay} opens — this would be open #${info.opensUsed + 1}.`;
    overageEl.hidden = false;
  }
  for (const minutes of info.choices) {
    const btn = document.createElement("button");
    btn.textContent = `${minutes} min`;
    btn.addEventListener("click", () => grant(minutes));
    choicesEl.append(btn);
  }
}

async function grant(minutes) {
  const res = await browser.runtime.sendMessage({ type: "grant-open", groupId, minutes });
  if (res && res.ok) location.href = target;
}

function neverMind() {
  if (history.length > 1) {
    history.back();
  } else {
    browser.tabs.getCurrent().then((t) => browser.tabs.remove(t.id));
  }
}
```

- [ ] **Step 4: Manual verification**

Reload the extension (config from Task 5 Step 2 persists). Expected:

1. Navigate to `https://reddit.com` → pause page shows "Social", "5 of 5 opens left today", 3-second countdown, then `1/5/10/15 min` buttons (30/60 filtered out by the 15-min cap) and "Never mind".
2. Click "5 min" → lands on reddit; reloading reddit or opening it in a second tab passes straight through (one open consumed, shared session).
3. Click "Never mind" instead (fresh tab) → tab closes; from an existing page → goes back.
4. In the extension console set `strictBlocking: true` and `opensUsedByGroup` ≥ 5 via `browser.storage.local.set`; visit reddit → "Out of opens for today.", no duration buttons. With `strictBlocking: false` → overage warning + buttons still present.
5. Grant "1 min", wait 60–65 s with the reddit tab open → tab is redirected back to the pause page.

- [ ] **Step 5: Commit**

```bash
git add pause/
git commit -m "feat: mindful pause page with countdown and opens display"
```

---

### Task 7: Options page

**Files:**
- Create: `options/options.html`, `options/options.js`, `options/options.css`

- [ ] **Step 1: Create `options/options.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Mindful Pause — Options</title>
  <link rel="stylesheet" href="options.css" />
</head>
<body>
  <main>
    <h1>Mindful Pause</h1>
    <p class="hint">Group distracting sites; each group gets N opens per day. Changes save when you click Save.</p>
    <div id="groups"></div>
    <div class="toolbar">
      <button id="add-group">Add group</button>
      <button id="save" class="primary">Save</button>
      <span id="status" role="status"></span>
    </div>
  </main>
  <script type="module" src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `options/options.css`**

```css
:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem;
  background: light-dark(#f7f6f3, #1c1b1a); color: light-dark(#2b2a28, #e8e6e1); }
main { max-width: 44rem; margin: 0 auto; }
.hint { opacity: 0.7; }
fieldset { border: 1px solid light-dark(#d8d4cb, #45423e); border-radius: 8px;
  margin: 0 0 1rem; padding: 1rem; }
legend { padding: 0 0.4rem; font-weight: 600; }
label { display: block; margin: 0.6rem 0 0.2rem; font-size: 0.85rem; opacity: 0.8; }
input[type="text"], input[type="number"], textarea {
  font: inherit; width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem;
  border: 1px solid light-dark(#c9c4ba, #4a4844); border-radius: 6px;
  background: light-dark(#fff, #2a2927); color: inherit; }
textarea { min-height: 4rem; resize: vertical; }
.row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
.checkbox-line { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; }
.checkbox-line label { margin: 0; display: inline; }
.group-meta { font-size: 0.85rem; opacity: 0.7; margin-top: 0.5rem; }
.toolbar { display: flex; gap: 0.75rem; align-items: center; }
button { font: inherit; padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer;
  border: 1px solid light-dark(#c9c4ba, #4a4844);
  background: light-dark(#fff, #2a2927); color: inherit; }
button.primary { background: light-dark(#2b2a28, #e8e6e1);
  color: light-dark(#fff, #1c1b1a); border-color: transparent; }
button.danger { color: light-dark(#a02c2c, #e07a7a); }
#status { opacity: 0.7; font-size: 0.9rem; }
```

- [ ] **Step 3: Create `options/options.js`**

```js
import { normalizeDomain, opensUsed, ensureDay } from "../src/logic.js";

const groupsEl = document.getElementById("groups");
const statusEl = document.getElementById("status");

let groups = [];
let state = null;

document.getElementById("add-group").addEventListener("click", () => {
  groups.push(newGroup());
  render();
});
document.getElementById("save").addEventListener("click", save);

load();

function newGroup() {
  return {
    id: crypto.randomUUID(),
    name: "New group",
    domains: [],
    maxOpensPerDay: 5,
    maxMinutesPerOpen: 15,
    strictBlocking: false,
    pauseSeconds: 10,
    allowanceOptions: [1, 5, 10, 15, 30, 60],
  };
}

async function load() {
  const data = await browser.storage.local.get({ groups: [], state: null });
  groups = Array.isArray(data.groups) ? data.groups : [];
  state = ensureDay(data.state, Date.now());
  render();
}

function render() {
  groupsEl.replaceChildren(...groups.map(renderGroup));
}

function renderGroup(group) {
  const fs = document.createElement("fieldset");
  fs.dataset.id = group.id;

  const legend = document.createElement("legend");
  legend.textContent = group.name;
  fs.append(legend);

  fs.append(
    field("Name", input("text", group.name, "name")),
    field("Sites (one domain per line, subdomains included)",
      textarea(group.domains.join("\n"), "domains")),
  );

  const row = document.createElement("div");
  row.className = "row";
  row.append(
    field("Opens per day", input("number", group.maxOpensPerDay, "maxOpensPerDay")),
    field("Max minutes per open", input("number", group.maxMinutesPerOpen, "maxMinutesPerOpen")),
    field("Pause seconds", input("number", group.pauseSeconds, "pauseSeconds")),
  );
  fs.append(row);

  fs.append(field("Duration choices (minutes, comma-separated)",
    input("text", group.allowanceOptions.join(", "), "allowanceOptions")));

  const strictLine = document.createElement("div");
  strictLine.className = "checkbox-line";
  const strict = document.createElement("input");
  strict.type = "checkbox";
  strict.checked = group.strictBlocking;
  strict.dataset.key = "strictBlocking";
  strict.id = `strict-${group.id}`;
  const strictLabel = document.createElement("label");
  strictLabel.htmlFor = strict.id;
  strictLabel.textContent = "Strict blocking (no more opens once you hit the limit)";
  strictLine.append(strict, strictLabel);
  fs.append(strictLine);

  const meta = document.createElement("p");
  meta.className = "group-meta";
  meta.textContent = `Opens used today: ${opensUsed(state, group.id)}`;
  fs.append(meta);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "danger";
  del.textContent = "Delete group";
  del.addEventListener("click", () => {
    groups = groups.filter((g) => g.id !== group.id);
    render();
  });
  fs.append(del);

  return fs;
}

function field(labelText, control) {
  const wrap = document.createElement("div");
  const label = document.createElement("label");
  label.textContent = labelText;
  wrap.append(label, control);
  return wrap;
}

function input(type, value, key) {
  const el = document.createElement("input");
  el.type = type;
  el.value = value;
  el.dataset.key = key;
  if (type === "number") el.min = "0";
  return el;
}

function textarea(value, key) {
  const el = document.createElement("textarea");
  el.value = value;
  el.dataset.key = key;
  return el;
}

function readGroupFromForm(fs) {
  const get = (key) => fs.querySelector(`[data-key="${key}"]`);
  return {
    id: fs.dataset.id,
    name: get("name").value.trim() || "Unnamed group",
    domains: get("domains").value.split("\n").map(normalizeDomain).filter(Boolean),
    maxOpensPerDay: clampInt(get("maxOpensPerDay").value, 1, 999, 5),
    maxMinutesPerOpen: clampInt(get("maxMinutesPerOpen").value, 1, 24 * 60, 15),
    pauseSeconds: clampInt(get("pauseSeconds").value, 0, 300, 10),
    strictBlocking: get("strictBlocking").checked,
    allowanceOptions: get("allowanceOptions").value
      .split(",")
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n > 0),
  };
}

function clampInt(raw, min, max, fallback) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function save() {
  groups = [...groupsEl.querySelectorAll("fieldset")].map(readGroupFromForm);
  await browser.storage.local.set({ groups });
  statusEl.textContent = "Saved.";
  setTimeout(() => (statusEl.textContent = ""), 2000);
  render();
}
```

- [ ] **Step 4: Manual verification**

Reload the extension → `about:debugging` → Mindful Pause → "Options" (or the gear in about:addons). Expected:

1. The seeded "Social" group appears with its domains, numbers, and "Opens used today".
2. Add a group "Video" with domain `https://www.youtube.com/feed` on one line → after Save it is stored as `www.youtube.com`.
3. Toggle strict blocking, Save, reload the page → the checkbox state persists.
4. Delete a group, Save → visiting its sites is no longer intercepted.

- [ ] **Step 5: Commit**

```bash
git add options/
git commit -m "feat: options page for group management"
```

---

### Task 8: README and final verification sweep

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Mindful Pause

A ScreenZen-style mindful-pause extension for Firefox and Zen Browser with
near-zero resource usage: no polling, no background processes, no content
scripts. The background script is event-driven and suspended when idle.

## What it does

- Navigating to a flagged site shows a pause page: breathe through a short
  countdown, then choose how many minutes to open it for — or walk away.
- Sites live in **groups** (e.g. *Social* = reddit.com + x.com). Each group
  has a max number of **opens per day** and a max duration per open. One open
  starts a wall-clock session shared by the whole group.
- Going past your daily opens is allowed by default — the pause page just
  tells you plainly. Enable **strict blocking** per group to make the limit
  hard until midnight.

## Install (temporary, for development)

1. Firefox/Zen → `about:debugging#/runtime/this-firefox`
2. "Load Temporary Add-on…" → select `manifest.json`
3. Open the extension's Options page and add your site groups.

Temporary add-ons unload when the browser closes. For a permanent install,
package with `web-ext build` and sign via addons.mozilla.org (unlisted), or
set `xpinstall.signatures.required = false` in a non-release build.

## Development

- Pure logic lives in `src/logic.js`; run `npm test` (Node built-in test
  runner, zero dependencies).
- `background.js` is thin event glue; UI pages are `pause/` and `options/`.

Design spec: `docs/superpowers/specs/2026-07-15-mindful-pause-extension-design.md`
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS, 11 tests, exit 0.

- [ ] **Step 3: Full manual walkthrough (spec's manual test list)**

With the extension loaded and a real config saved via the options page, verify each spec item: pause flow → session grant → same-group second tab passes free → session expiry redirects the tab back → overage message (default) vs. blocked page (strict) → lazy day reset (set `state.day` to yesterday via the extension console, visit a flagged site, confirm opens reset to 0).

- [ ] **Step 4: Commit and push**

```bash
git add README.md
git commit -m "docs: README with install and usage"
git push
```
