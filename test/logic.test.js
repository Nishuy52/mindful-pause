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
