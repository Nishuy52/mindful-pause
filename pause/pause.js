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
