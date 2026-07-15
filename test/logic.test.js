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
