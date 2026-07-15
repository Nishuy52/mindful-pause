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
