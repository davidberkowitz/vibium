// content.js — Observes DOM mutations and sends structured change logs to the background worker.

(function () {
  "use strict";

  // Avoid double-injection.
  if (window.__docChangeLoggerActive) return;
  window.__docChangeLoggerActive = true;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Produce a short, human-readable selector-like label for a node. */
  function describeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      return `#text "${text.length > 60 ? text.slice(0, 60) + "…" : text}"`;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return node.nodeName;

    const el = node;
    let label = el.tagName.toLowerCase();
    if (el.id) label += `#${el.id}`;
    if (el.classList.length) label += `.${[...el.classList].join(".")}`;

    // Include role if present (useful for AI-driven UIs).
    const role = el.getAttribute("role");
    if (role) label += `[role="${role}"]`;

    return label;
  }

  /** Build a compact path from the node to the document root. */
  function nodePath(node) {
    const parts = [];
    let cur = node;
    while (cur && cur !== document.documentElement) {
      parts.unshift(describeNode(cur));
      cur = cur.parentNode;
    }
    return parts.join(" > ");
  }

  /** Snapshot the current high-level document outline (tag tree to depth 4). */
  function snapshotOutline(root, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 4 || !root) return null;
    if (root.nodeType !== Node.ELEMENT_NODE) return null;

    const tag = root.tagName.toLowerCase();
    // Skip script/style/svg internals for readability.
    if (["script", "style", "link", "noscript"].includes(tag)) return null;

    const entry = { tag: describeNode(root) };
    const kids = [];
    for (const child of root.children) {
      const snap = snapshotOutline(child, depth + 1);
      if (snap) kids.push(snap);
    }
    if (kids.length) entry.children = kids;
    return entry;
  }

  // ---------------------------------------------------------------------------
  // Mutation batching
  // ---------------------------------------------------------------------------

  let pendingRecords = [];
  let flushTimer = null;

  function scheduleBatchFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushBatch, 300); // debounce 300ms
  }

  function flushBatch() {
    flushTimer = null;
    if (pendingRecords.length === 0) return;

    const records = pendingRecords;
    pendingRecords = [];

    const changes = processRecords(records);
    if (changes.length === 0) return;

    const message = {
      type: "DOM_CHANGES",
      timestamp: new Date().toISOString(),
      url: location.href,
      title: document.title,
      changes: changes,
      outline: snapshotOutline(document.documentElement),
    };

    try {
      chrome.runtime.sendMessage(message);
    } catch (_) {
      // Extension context invalidated (e.g. reload). Silently stop.
      observer.disconnect();
    }
  }

  // ---------------------------------------------------------------------------
  // Record processing
  // ---------------------------------------------------------------------------

  function processRecords(records) {
    const changes = [];

    for (const rec of records) {
      if (rec.type === "childList") {
        for (const node of rec.addedNodes) {
          if (isIgnored(node)) continue;
          changes.push({
            kind: "added",
            target: nodePath(rec.target),
            node: describeNode(node),
            html: summariseHTML(node),
          });
        }
        for (const node of rec.removedNodes) {
          if (isIgnored(node)) continue;
          changes.push({
            kind: "removed",
            target: nodePath(rec.target),
            node: describeNode(node),
          });
        }
      } else if (rec.type === "attributes") {
        changes.push({
          kind: "attribute",
          target: nodePath(rec.target),
          attribute: rec.attributeName,
          oldValue: rec.oldValue,
          newValue: rec.target.getAttribute(rec.attributeName),
        });
      } else if (rec.type === "characterData") {
        changes.push({
          kind: "text",
          target: nodePath(rec.target),
          oldValue: truncate(rec.oldValue),
          newValue: truncate(rec.target.textContent),
        });
      }
    }

    return changes;
  }

  function isIgnored(node) {
    if (node.nodeType === Node.COMMENT_NODE) return true;
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) return true;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (["script", "style", "link", "noscript"].includes(tag)) return true;
    }
    return false;
  }

  function truncate(str) {
    if (!str) return str;
    return str.length > 200 ? str.slice(0, 200) + "…" : str;
  }

  function summariseHTML(node) {
    if (node.nodeType === Node.TEXT_NODE) return truncate(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const html = node.outerHTML || "";
    return truncate(html);
  }

  // ---------------------------------------------------------------------------
  // Observer setup
  // ---------------------------------------------------------------------------

  const observer = new MutationObserver(function (records) {
    pendingRecords.push(...records);
    scheduleBatchFlush();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true,
  });

  // Send an initial snapshot so the panel has something immediately.
  try {
    chrome.runtime.sendMessage({
      type: "DOM_SNAPSHOT",
      timestamp: new Date().toISOString(),
      url: location.href,
      title: document.title,
      outline: snapshotOutline(document.documentElement),
    });
  } catch (_) {
    // Ignore if background not ready yet.
  }

  // Listen for explicit snapshot requests from the panel.
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === "REQUEST_SNAPSHOT") {
      try {
        chrome.runtime.sendMessage({
          type: "DOM_SNAPSHOT",
          timestamp: new Date().toISOString(),
          url: location.href,
          title: document.title,
          outline: snapshotOutline(document.documentElement),
        });
      } catch (_) {}
    }
  });
})();
