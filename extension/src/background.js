// background.js — Service worker that routes messages between content script and side panel.

"use strict";

// Open the side panel when the extension action icon is clicked.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Store recent logs per tab so the panel can hydrate when opened.
const tabLogs = new Map(); // tabId -> { snapshot, changes[] }
const MAX_LOG_ENTRIES = 500;

function getTabStore(tabId) {
  if (!tabLogs.has(tabId)) {
    tabLogs.set(tabId, { snapshot: null, changes: [] });
  }
  return tabLogs.get(tabId);
}

// Clean up when tabs close.
chrome.tabs.onRemoved.addListener(function (tabId) {
  tabLogs.delete(tabId);
});

// Route messages from content scripts.
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!sender.tab) {
    // Message from the panel — forward to content script.
    if (message.type === "REQUEST_SNAPSHOT") {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, message);
        }
      });
      return;
    }
    if (message.type === "GET_LOGS") {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          const store = getTabStore(tabs[0].id);
          sendResponse({ snapshot: store.snapshot, changes: store.changes });
        } else {
          sendResponse({ snapshot: null, changes: [] });
        }
      });
      return true; // async sendResponse
    }
    if (message.type === "CLEAR_LOGS") {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          const store = getTabStore(tabs[0].id);
          store.changes = [];
          sendResponse({ ok: true });
        }
      });
      return true;
    }
    return;
  }

  const tabId = sender.tab.id;
  const store = getTabStore(tabId);

  if (message.type === "DOM_SNAPSHOT") {
    store.snapshot = message;
    // Broadcast to any open panel connections.
    broadcastToPanel(message);
  } else if (message.type === "DOM_CHANGES") {
    store.changes.push(message);
    if (store.changes.length > MAX_LOG_ENTRIES) {
      store.changes = store.changes.slice(-MAX_LOG_ENTRIES);
    }
    store.snapshot = { type: "DOM_SNAPSHOT", timestamp: message.timestamp, url: message.url, title: message.title, outline: message.outline };
    broadcastToPanel(message);
  }
});

// Panel communication via a long-lived port.
const panelPorts = new Set();

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name !== "panel") return;
  panelPorts.add(port);
  port.onDisconnect.addListener(function () {
    panelPorts.delete(port);
  });
});

function broadcastToPanel(message) {
  for (const port of panelPorts) {
    try {
      port.postMessage(message);
    } catch (_) {
      panelPorts.delete(port);
    }
  }
}
