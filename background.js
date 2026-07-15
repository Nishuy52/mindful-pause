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
