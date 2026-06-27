// panel.js — Thinking session recorder UI.

"use strict";

var outlineTree = document.getElementById("outline-tree");
var pageMeta = document.getElementById("page-meta");
var sessionList = document.getElementById("session-list");
var sessionCount = document.getElementById("session-count");
var btnRecord = document.getElementById("btn-record");
var btnClear = document.getElementById("btn-clear");
var recordingBanner = document.getElementById("recording-banner");
var recordingTimer = document.getElementById("recording-timer");

var recording = false;
var sessionIdx = 0;
var firstSession = true;
var recordingStartTime = null;
var timerInterval = null;

// Currently-recording session element, kept open and appended to live.
var activeSessionEl = null;
var activeBodyEl = null;

// ---------------------------------------------------------------------------
// Connection to background
// ---------------------------------------------------------------------------

var port = chrome.runtime.connect({ name: "panel" });

port.onMessage.addListener(function (msg) {
  if (msg.type === "SESSION_START") {
    onSessionStart(msg);
  } else if (msg.type === "SESSION_END") {
    onSessionEnd(msg);
  } else if (msg.type === "THINKING_UPDATE") {
    onThinkingUpdate(msg);
  } else if (msg.type === "DOM_SNAPSHOT") {
    renderOutline(msg);
  }
});

// Hydrate on panel open.
chrome.runtime.sendMessage({ type: "GET_STATE" }, function (resp) {
  if (!resp) return;
  recording = resp.recording;
  updateRecordButton();
  if (resp.sessions && resp.sessions.length) {
    for (var i = 0; i < resp.sessions.length; i++) {
      hydrateSession(resp.sessions[i], i);
    }
  }
});

// Refresh on tab switch.
chrome.tabs.onActivated.addListener(function () {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, function (resp) {
    if (!resp) return;
    recording = resp.recording;
    updateRecordButton();
    sessionList.innerHTML = '<em class="muted">No sessions yet. Hit Record, then prompt the AI.</em>';
    sessionIdx = 0;
    firstSession = true;
    activeSessionEl = null;
    activeBodyEl = null;
    if (resp.sessions && resp.sessions.length) {
      for (var i = 0; i < resp.sessions.length; i++) {
        hydrateSession(resp.sessions[i], i);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Recording controls
// ---------------------------------------------------------------------------

btnRecord.addEventListener("click", function () {
  recording = !recording;
  chrome.runtime.sendMessage({ type: "SET_RECORDING", recording: recording });
  updateRecordButton();
});

btnClear.addEventListener("click", function () {
  chrome.runtime.sendMessage({ type: "CLEAR_SESSIONS" }, function () {
    sessionList.innerHTML = '<em class="muted">No sessions yet. Hit Record, then prompt the AI.</em>';
    sessionIdx = 0;
    firstSession = true;
    sessionCount.textContent = "0";
    activeSessionEl = null;
    activeBodyEl = null;
    recording = false;
    updateRecordButton();
  });
});

function updateRecordButton() {
  if (recording) {
    btnRecord.textContent = "Stop";
    btnRecord.classList.add("recording");
    recordingBanner.classList.remove("hidden");
    recordingStartTime = Date.now();
    startTimer();
  } else {
    btnRecord.textContent = "Record";
    btnRecord.classList.remove("recording");
    recordingBanner.classList.add("hidden");
    stopTimer();
  }
}

function startTimer() {
  stopTimer();
  timerInterval = setInterval(function () {
    if (!recordingStartTime) return;
    var elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    var m = Math.floor(elapsed / 60);
    var s = elapsed % 60;
    recordingTimer.textContent = m + ":" + (s < 10 ? "0" : "") + s;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Session rendering
// ---------------------------------------------------------------------------

function onSessionStart(msg) {
  renderOutline(msg);
  ensureListReady();
  sessionIdx++;
  sessionCount.textContent = sessionIdx;

  // Close any previously open session.
  collapseAllSessions();

  var details = document.createElement("details");
  details.className = "session";
  details.open = true;

  var summary = document.createElement("summary");
  summary.innerHTML =
    '<span class="session-num">#' + sessionIdx + "</span> " +
    '<time class="session-time">' + formatTime(msg.timestamp) + "</time> " +
    '<span class="session-status recording-text">Recording…</span>';
  details.appendChild(summary);

  var body = document.createElement("div");
  body.className = "session-body";
  details.appendChild(body);

  sessionList.prepend(details);
  activeSessionEl = details;
  activeBodyEl = body;
}

function onSessionEnd(msg) {
  renderOutline(msg);
  if (activeSessionEl) {
    var status = activeSessionEl.querySelector(".session-status");
    if (status) {
      var startTime = activeSessionEl.querySelector(".session-time");
      var duration = "";
      if (startTime && msg.timestamp) {
        var ms = new Date(msg.timestamp) - new Date(startTime.textContent || startTime.dateTime || "");
        if (isNaN(ms)) {
          duration = "";
        } else {
          duration = " (" + formatDuration(ms) + ")";
        }
      }
      status.textContent = "Done" + duration;
      status.classList.remove("recording-text");
      status.classList.add("done-text");
    }
    // Add a final summary of changes.
    var total = activeBodyEl ? activeBodyEl.querySelectorAll(".change").length : 0;
    if (total > 0 && activeBodyEl) {
      var footer = document.createElement("div");
      footer.className = "session-footer";
      footer.textContent = total + " change" + (total !== 1 ? "s" : "") + " captured";
      activeBodyEl.appendChild(footer);
    }
  }
  activeSessionEl = null;
  activeBodyEl = null;
  recording = false;
  updateRecordButton();
}

function onThinkingUpdate(msg) {
  renderOutline(msg);
  if (!activeBodyEl) return;

  // Each update batch becomes a collapsible sub-group within the session.
  var count = msg.changes ? msg.changes.length : 0;
  if (count === 0) return;

  var group = document.createElement("details");
  group.className = "update-group";
  group.open = true;

  // Close the previous update group.
  var prev = activeBodyEl.querySelector("details.update-group[open]");
  if (prev) prev.open = false;

  var summary = document.createElement("summary");
  summary.innerHTML =
    '<time>' + formatTime(msg.timestamp) + "</time> " +
    '<span class="change-count">' + count + " change" + (count !== 1 ? "s" : "") + "</span>";
  group.appendChild(summary);

  var body = document.createElement("div");
  body.className = "update-body";

  for (var i = 0; i < msg.changes.length; i++) {
    body.appendChild(renderChange(msg.changes[i]));
  }

  group.appendChild(body);
  activeBodyEl.appendChild(group);

  // Auto-scroll the session body to keep the latest visible.
  activeBodyEl.scrollTop = activeBodyEl.scrollHeight;
}

// ---------------------------------------------------------------------------
// Hydrate from stored sessions (panel re-open)
// ---------------------------------------------------------------------------

function hydrateSession(session, idx) {
  ensureListReady();
  sessionIdx = idx + 1;
  sessionCount.textContent = sessionIdx;

  var details = document.createElement("details");
  details.className = "session";
  // Only the last session (most recent) should be open.
  details.open = !session.end;

  var summary = document.createElement("summary");
  var statusText = session.end
    ? "Done (" + formatDuration(new Date(session.end) - new Date(session.start)) + ")"
    : "Recording…";
  var statusClass = session.end ? "done-text" : "recording-text";
  summary.innerHTML =
    '<span class="session-num">#' + sessionIdx + "</span> " +
    '<time class="session-time">' + formatTime(session.start) + "</time> " +
    '<span class="session-status ' + statusClass + '">' + statusText + "</span>";
  details.appendChild(summary);

  var body = document.createElement("div");
  body.className = "session-body";

  var totalChanges = 0;
  if (session.updates) {
    for (var u = 0; u < session.updates.length; u++) {
      var msg = session.updates[u];
      var count = msg.changes ? msg.changes.length : 0;
      if (count === 0) continue;
      totalChanges += count;

      var group = document.createElement("details");
      group.className = "update-group";

      var gSummary = document.createElement("summary");
      gSummary.innerHTML =
        '<time>' + formatTime(msg.timestamp) + "</time> " +
        '<span class="change-count">' + count + " change" + (count !== 1 ? "s" : "") + "</span>";
      group.appendChild(gSummary);

      var gBody = document.createElement("div");
      gBody.className = "update-body";
      for (var c = 0; c < msg.changes.length; c++) {
        gBody.appendChild(renderChange(msg.changes[c]));
      }
      group.appendChild(gBody);
      body.appendChild(group);
    }
  }

  if (session.end && totalChanges > 0) {
    var footer = document.createElement("div");
    footer.className = "session-footer";
    footer.textContent = totalChanges + " change" + (totalChanges !== 1 ? "s" : "") + " captured";
    body.appendChild(footer);
  }

  details.appendChild(body);
  sessionList.prepend(details);

  if (!session.end) {
    activeSessionEl = details;
    activeBodyEl = body;
  }

  // Render the latest outline.
  var outline = session.outlineEnd || session.outlineStart;
  if (outline) {
    renderOutline({ outline: outline, title: session.title, url: session.url });
  }
}

// ---------------------------------------------------------------------------
// Outline rendering
// ---------------------------------------------------------------------------

function renderOutline(msg) {
  pageMeta.textContent = msg.title ? msg.title + " — " + msg.url : msg.url || "";
  if (!msg.outline) {
    outlineTree.innerHTML = '<em class="muted">No outline available.</em>';
    return;
  }
  outlineTree.innerHTML = "";
  var ul = document.createElement("ul");
  ul.appendChild(buildTree(msg.outline));
  outlineTree.appendChild(ul);
}

function buildTree(node) {
  var li = document.createElement("li");
  var label = document.createElement("span");
  label.className = "tree-label";
  label.textContent = node.tag;
  li.appendChild(label);
  if (node.children && node.children.length) {
    var ul = document.createElement("ul");
    for (var i = 0; i < node.children.length; i++) {
      ul.appendChild(buildTree(node.children[i]));
    }
    li.appendChild(ul);
  }
  return li;
}

// ---------------------------------------------------------------------------
// Individual change rendering
// ---------------------------------------------------------------------------

function renderChange(c) {
  var div = document.createElement("div");
  div.className = "change " + c.kind;

  var badge = document.createElement("span");
  badge.className = "kind-badge " + c.kind;
  badge.textContent = c.kind;
  div.appendChild(badge);

  var target = document.createElement("code");
  target.className = "target";
  target.textContent = c.target;
  div.appendChild(target);

  if (c.kind === "added") {
    if (c.text) {
      var txt = document.createElement("span");
      txt.className = "content-text added-text";
      txt.textContent = c.text;
      div.appendChild(txt);
    } else {
      var node = document.createElement("span");
      node.className = "node-desc";
      node.textContent = c.node;
      div.appendChild(node);
    }
  } else if (c.kind === "removed") {
    var rm = document.createElement("span");
    rm.className = "node-desc removed-text";
    rm.textContent = c.node;
    div.appendChild(rm);
  } else if (c.kind === "text") {
    if (c.oldValue) {
      var old = document.createElement("del");
      old.textContent = c.oldValue;
      div.appendChild(old);
    }
    if (c.newValue) {
      var ins = document.createElement("ins");
      ins.textContent = c.newValue;
      div.appendChild(ins);
    }
  } else if (c.kind === "attribute") {
    var attr = document.createElement("span");
    attr.className = "attr-name";
    attr.textContent = c.attribute;
    div.appendChild(attr);
    if (c.oldValue !== null && c.oldValue !== undefined) {
      var oldA = document.createElement("del");
      oldA.textContent = c.oldValue;
      div.appendChild(oldA);
    }
    if (c.newValue !== null && c.newValue !== undefined) {
      var insA = document.createElement("ins");
      insA.textContent = c.newValue;
      div.appendChild(insA);
    }
  }

  return div;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureListReady() {
  if (firstSession) {
    sessionList.innerHTML = "";
    firstSession = false;
  }
}

function collapseAllSessions() {
  var open = sessionList.querySelectorAll("details.session[open]");
  for (var i = 0; i < open.length; i++) {
    open[i].open = false;
  }
}

function formatTime(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (_) {
    return iso || "";
  }
}

function formatDuration(ms) {
  if (isNaN(ms) || ms < 0) return "0s";
  var s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  var m = Math.floor(s / 60);
  s = s % 60;
  return m + "m " + s + "s";
}
