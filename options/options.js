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
