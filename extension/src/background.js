// background.js — Routes messages and manages thinking session state per tab.

"use strict";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Per-tab state: { recording, sessions: [{ start, end, updates[], outline }] }
var tabState = new Map();
var MAX_SESSIONS = 50;
var MAX_UPDATES_PER_SESSION = 500;

function getState(tabId) {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, { recording: false, sessions: [] });
  }
  return tabState.get(tabId);
}

function currentSession(state) {
  if (state.sessions.length === 0) return null;
  var last = state.sessions[state.sessions.length - 1];
  return last.end ? null : last;
}

chrome.tabs.onRemoved.addListener(function (tabId) {
  tabState.delete(tabId);
});

chrome.webNavigation.onCommitted.addListener(function (details) {
  if (details.frameId !== 0) return;
  var state = getState(details.tabId);
  // End any active session on navigation.
  var session = currentSession(state);
  if (session) {
    session.end = new Date().toISOString();
    state.recording = false;
  }
});

// -----------------------------------------------------------------------
// Message routing
// -----------------------------------------------------------------------

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  // Messages from the panel (no sender.tab).
  if (!sender.tab) {
    if (message.type === "SET_RECORDING") {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (!tabs[0]) return;
        var tabId = tabs[0].id;
        var state = getState(tabId);
        state.recording = message.recording;
        // Forward to content script.
        chrome.tabs.sendMessage(tabId, message);
      });
      return;
    }
    if (message.type === "GET_STATE") {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (!tabs[0]) {
          sendResponse({ recording: false, sessions: [] });
          return;
        }
        var state = getState(tabs[0].id);
        sendResponse({ recording: state.recording, sessions: state.sessions });
      });
      return true;
    }
    if (message.type === "CLEAR_SESSIONS") {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (!tabs[0]) return;
        var state = getState(tabs[0].id);
        var wasRecording = state.recording;
        state.sessions = [];
        state.recording = false;
        if (wasRecording) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "SET_RECORDING", recording: false });
        }
        sendResponse({ ok: true });
      });
      return true;
    }
    if (message.type === "REQUEST_SNAPSHOT") {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, message);
      });
      return;
    }
    return;
  }

  // Messages from content scripts.
  var tabId = sender.tab.id;
  var state = getState(tabId);

  if (message.type === "SESSION_START") {
    var session = {
      start: message.timestamp,
      end: null,
      url: message.url,
      title: message.title,
      outlineStart: message.outline,
      outlineEnd: null,
      updates: [],
    };
    state.sessions.push(session);
    if (state.sessions.length > MAX_SESSIONS) {
      state.sessions = state.sessions.slice(-MAX_SESSIONS);
    }
    broadcastToPanel(message);
  } else if (message.type === "SESSION_END") {
    var cur = currentSession(state);
    if (cur) {
      cur.end = message.timestamp;
      cur.outlineEnd = message.outline;
    }
    broadcastToPanel(message);
  } else if (message.type === "THINKING_UPDATE") {
    var active = currentSession(state);
    if (active) {
      active.updates.push(message);
      if (active.updates.length > MAX_UPDATES_PER_SESSION) {
        active.updates = active.updates.slice(-MAX_UPDATES_PER_SESSION);
      }
      active.outlineEnd = message.outline;
    }
    broadcastToPanel(message);
  } else if (message.type === "DOM_SNAPSHOT") {
    broadcastToPanel(message);
  }
});

// -----------------------------------------------------------------------
// Panel ports
// -----------------------------------------------------------------------

var panelPorts = new Set();

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name !== "panel") return;
  panelPorts.add(port);
  port.onDisconnect.addListener(function () {
    panelPorts.delete(port);
  });
});

function broadcastToPanel(message) {
  for (var port of panelPorts) {
    try {
      port.postMessage(message);
    } catch (_) {
      panelPorts.delete(port);
    }
  }
}
