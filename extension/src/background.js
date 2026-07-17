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
  var session = currentSession(state);
  if (session) {
    session.end = new Date().toISOString();
    state.recording = false;
  }
});

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// Find the target content tab — the non-extension tab the user is working in.
// Works whether the panel is a real side panel or opened as a standalone tab.
function findContentTab(cb) {
  chrome.tabs.query({ currentWindow: true }, function (allTabs) {
    // Prefer the active non-extension tab.
    var best = null;
    for (var i = 0; i < allTabs.length; i++) {
      var t = allTabs[i];
      if (t.url && t.url.startsWith("chrome-extension://")) continue;
      if (t.url && t.url.startsWith("chrome://")) continue;
      if (!best || t.active) best = t;
    }
    cb(best);
  });
}

// -----------------------------------------------------------------------
// Message routing
// -----------------------------------------------------------------------

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  // Distinguish panel/extension-page messages from content-script messages.
  // When the panel is opened as a tab (not a side panel), sender.tab exists
  // but the URL is chrome-extension://.
  var fromExtensionPage = !sender.tab
    || (sender.url && sender.url.startsWith("chrome-extension://"));

  if (fromExtensionPage) {
    if (message.type === "SET_RECORDING") {
      findContentTab(function (tab) {
        if (!tab) return;
        var state = getState(tab.id);
        state.recording = message.recording;
        chrome.tabs.sendMessage(tab.id, message);
      });
      return;
    }
    if (message.type === "GET_STATE") {
      findContentTab(function (tab) {
        if (!tab) {
          sendResponse({ recording: false, sessions: [] });
          return;
        }
        var state = getState(tab.id);
        sendResponse({ recording: state.recording, sessions: state.sessions });
      });
      return true;
    }
    if (message.type === "CLEAR_SESSIONS") {
      findContentTab(function (tab) {
        if (!tab) return;
        var state = getState(tab.id);
        var wasRecording = state.recording;
        state.sessions = [];
        state.recording = false;
        if (wasRecording) {
          chrome.tabs.sendMessage(tab.id, { type: "SET_RECORDING", recording: false });
        }
        sendResponse({ ok: true });
      });
      return true;
    }
    if (message.type === "REQUEST_SNAPSHOT") {
      findContentTab(function (tab) {
        if (tab) chrome.tabs.sendMessage(tab.id, message);
      });
      return;
    }
    if (message.type === "PING") {
      findContentTab(function (tab) {
        if (!tab) {
          sendResponse({ ok: false, error: "No content tab found" });
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: "PING" }, function (resp) {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              tabId: tab.id,
              tabUrl: tab.url,
              tabTitle: tab.title,
              error: chrome.runtime.lastError.message,
            });
          } else {
            sendResponse({
              ok: true,
              tabId: tab.id,
              tabUrl: tab.url,
              tabTitle: tab.title,
              contentScript: resp,
            });
          }
        });
      });
      return true;
    }
    if (message.type === "GET_TAB_INFO") {
      findContentTab(function (tab) {
        if (!tab) {
          sendResponse({ found: false });
          return;
        }
        sendResponse({
          found: true,
          tabId: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
        });
      });
      return true;
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
