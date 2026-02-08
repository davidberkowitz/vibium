// panel.js — Drives the side panel UI: renders the document outline and change history.

"use strict";

const outlineTree = document.getElementById("outline-tree");
const pageMeta = document.getElementById("page-meta");
const logEntries = document.getElementById("log-entries");
const changeCount = document.getElementById("change-count");
const btnRefresh = document.getElementById("btn-refresh");
const btnClear = document.getElementById("btn-clear");
const chkPause = document.getElementById("chk-pause");

let paused = false;
let entryCount = 0;
let firstEntry = true;

// ---------------------------------------------------------------------------
// Long-lived connection to background for real-time updates
// ---------------------------------------------------------------------------

const port = chrome.runtime.connect({ name: "panel" });

port.onMessage.addListener(function (msg) {
  if (paused) return;
  if (msg.type === "DOM_SNAPSHOT") {
    renderSnapshot(msg);
  } else if (msg.type === "DOM_CHANGES") {
    renderSnapshot(msg); // outline is embedded in change messages too
    renderChangeEntry(msg);
  }
});

// Hydrate with existing logs on open.
chrome.runtime.sendMessage({ type: "GET_LOGS" }, function (resp) {
  if (!resp) return;
  if (resp.snapshot) renderSnapshot(resp.snapshot);
  if (resp.changes && resp.changes.length) {
    for (const entry of resp.changes) {
      renderChangeEntry(entry);
    }
  }
});

// ---------------------------------------------------------------------------
// Rendering: document outline
// ---------------------------------------------------------------------------

function renderSnapshot(msg) {
  pageMeta.textContent = msg.title ? `${msg.title} — ${msg.url}` : msg.url || "";
  if (!msg.outline) {
    outlineTree.innerHTML = '<em class="muted">No outline available.</em>';
    return;
  }
  outlineTree.innerHTML = "";
  outlineTree.appendChild(buildTree(msg.outline));
}

function buildTree(node) {
  const li = document.createElement("li");
  const label = document.createElement("span");
  label.className = "tree-label";
  label.textContent = node.tag;
  li.appendChild(label);

  if (node.children && node.children.length) {
    const ul = document.createElement("ul");
    for (const child of node.children) {
      ul.appendChild(buildTree(child));
    }
    li.appendChild(ul);
  }
  return li;
}

// ---------------------------------------------------------------------------
// Rendering: change history (disclosure / <details> elements)
// ---------------------------------------------------------------------------

function renderChangeEntry(msg) {
  if (firstEntry) {
    logEntries.innerHTML = "";
    firstEntry = false;
  }

  entryCount++;
  changeCount.textContent = entryCount;

  const details = document.createElement("details");
  // Most recent entry is open by default, previous ones stay closed.
  details.open = true;

  // Close the previously-open entry.
  const prev = logEntries.querySelector("details[open]");
  if (prev) prev.open = false;

  const summary = document.createElement("summary");
  const time = formatTime(msg.timestamp);
  const count = msg.changes ? msg.changes.length : 0;
  summary.innerHTML =
    `<time>${time}</time> ` +
    `<span class="change-count">${count} change${count !== 1 ? "s" : ""}</span>`;
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "entry-body";

  if (msg.changes) {
    for (const c of msg.changes) {
      body.appendChild(renderChange(c));
    }
  }

  details.appendChild(body);
  logEntries.prepend(details); // newest on top
}

function renderChange(c) {
  const div = document.createElement("div");
  div.className = "change " + c.kind;

  const kindBadge = document.createElement("span");
  kindBadge.className = "kind-badge " + c.kind;
  kindBadge.textContent = c.kind;
  div.appendChild(kindBadge);

  const target = document.createElement("code");
  target.className = "target";
  target.textContent = c.target;
  div.appendChild(target);

  if (c.kind === "added") {
    const node = document.createElement("span");
    node.className = "node-desc";
    node.textContent = c.node;
    div.appendChild(node);
    if (c.html) {
      const pre = document.createElement("pre");
      pre.className = "html-preview";
      pre.textContent = c.html;
      div.appendChild(pre);
    }
  } else if (c.kind === "removed") {
    const node = document.createElement("span");
    node.className = "node-desc removed-text";
    node.textContent = c.node;
    div.appendChild(node);
  } else if (c.kind === "attribute") {
    const attr = document.createElement("span");
    attr.className = "attr-name";
    attr.textContent = c.attribute;
    div.appendChild(attr);
    if (c.oldValue !== null) {
      const old = document.createElement("del");
      old.textContent = c.oldValue;
      div.appendChild(old);
    }
    if (c.newValue !== null) {
      const ins = document.createElement("ins");
      ins.textContent = c.newValue;
      div.appendChild(ins);
    }
  } else if (c.kind === "text") {
    if (c.oldValue) {
      const old = document.createElement("del");
      old.textContent = c.oldValue;
      div.appendChild(old);
    }
    if (c.newValue) {
      const ins = document.createElement("ins");
      ins.textContent = c.newValue;
      div.appendChild(ins);
    }
  }

  return div;
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (_) {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Toolbar handlers
// ---------------------------------------------------------------------------

btnRefresh.addEventListener("click", function () {
  chrome.runtime.sendMessage({ type: "REQUEST_SNAPSHOT" });
});

btnClear.addEventListener("click", function () {
  chrome.runtime.sendMessage({ type: "CLEAR_LOGS" }, function () {
    logEntries.innerHTML = '<em class="muted">No changes recorded yet.</em>';
    entryCount = 0;
    firstEntry = true;
    changeCount.textContent = "0";
  });
});

chkPause.addEventListener("change", function () {
  paused = chkPause.checked;
});
