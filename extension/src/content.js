// content.js — Records document changes during AI "thinking" sessions.

(function () {
  "use strict";

  if (window.__docChangeLoggerActive) return;
  window.__docChangeLoggerActive = true;

  let recording = false;
  let textNodeHistory = new Map(); // node -> [snapshots]

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function describeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      var text = node.textContent.trim();
      return '#text "' + (text.length > 80 ? text.slice(0, 80) + "…" : text) + '"';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return node.nodeName;

    var el = node;
    var label = el.tagName.toLowerCase();
    if (el.id) label += "#" + el.id;
    if (el.classList.length) label += "." + Array.from(el.classList).join(".");

    var role = el.getAttribute("role");
    if (role) label += '[role="' + role + '"]';
    return label;
  }

  function nodePath(node) {
    var parts = [];
    var cur = node;
    while (cur && cur !== document.documentElement) {
      parts.unshift(describeNode(cur));
      cur = cur.parentNode;
    }
    return parts.join(" > ");
  }

  function extractText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    return node.innerText || node.textContent || "";
  }

  function truncate(str, len) {
    if (!str) return str;
    if (!len) len = 300;
    return str.length > len ? str.slice(0, len) + "…" : str;
  }

  function isNoiseAttribute(name) {
    // Class and style churn from animations/frameworks is noise for thinking capture.
    return name === "class" || name === "style" || name.startsWith("data-radix")
      || name === "aria-busy" || name === "tabindex";
  }

  function isIgnoredNode(node) {
    if (node.nodeType === Node.COMMENT_NODE) return true;
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) return true;
    if (node.nodeType === Node.ELEMENT_NODE) {
      var tag = node.tagName.toLowerCase();
      if (["script", "style", "link", "noscript", "svg", "meta"].includes(tag)) return true;
    }
    return false;
  }

  function snapshotOutline(root, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 4 || !root) return null;
    if (root.nodeType !== Node.ELEMENT_NODE) return null;
    var tag = root.tagName.toLowerCase();
    if (["script", "style", "link", "noscript", "svg", "meta"].includes(tag)) return null;
    var entry = { tag: describeNode(root) };
    var kids = [];
    for (var i = 0; i < root.children.length; i++) {
      var snap = snapshotOutline(root.children[i], depth + 1);
      if (snap) kids.push(snap);
    }
    if (kids.length) entry.children = kids;
    return entry;
  }

  // -------------------------------------------------------------------------
  // Mutation processing — thinking-oriented
  // -------------------------------------------------------------------------

  var pendingRecords = [];
  var flushTimer = null;

  function scheduleBatchFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushBatch, 250);
  }

  function flushBatch() {
    flushTimer = null;
    if (!recording || pendingRecords.length === 0) {
      pendingRecords = [];
      return;
    }

    var records = pendingRecords;
    pendingRecords = [];

    var changes = processRecords(records);
    if (changes.length === 0) return;
    if (changes.length > 200) changes = changes.slice(0, 200);

    try {
      chrome.runtime.sendMessage({
        type: "THINKING_UPDATE",
        timestamp: new Date().toISOString(),
        url: location.href,
        title: document.title,
        changes: changes,
        outline: snapshotOutline(document.documentElement),
      });
    } catch (_) {
      observer.disconnect();
    }
  }

  function processRecords(records) {
    var changes = [];

    for (var i = 0; i < records.length; i++) {
      var rec = records[i];

      if (rec.type === "childList") {
        for (var a = 0; a < rec.addedNodes.length; a++) {
          var added = rec.addedNodes[a];
          if (isIgnoredNode(added)) continue;
          var text = truncate(extractText(added));
          changes.push({
            kind: "added",
            target: nodePath(rec.target),
            node: describeNode(added),
            text: text || null,
          });
        }
        for (var r = 0; r < rec.removedNodes.length; r++) {
          var removed = rec.removedNodes[r];
          if (isIgnoredNode(removed)) continue;
          changes.push({
            kind: "removed",
            target: nodePath(rec.target),
            node: describeNode(removed),
          });
        }
      } else if (rec.type === "characterData") {
        // Coalesce repeated text updates on the same node — this is the
        // streaming-token pattern where content builds up incrementally.
        var path = nodePath(rec.target);
        var newText = truncate(rec.target.textContent);
        var oldText = truncate(rec.oldValue);
        // Only log if actual content changed meaningfully.
        if (newText !== oldText) {
          changes.push({
            kind: "text",
            target: path,
            oldValue: oldText,
            newValue: newText,
          });
        }
      } else if (rec.type === "attributes") {
        if (isNoiseAttribute(rec.attributeName)) continue;
        changes.push({
          kind: "attribute",
          target: nodePath(rec.target),
          attribute: rec.attributeName,
          oldValue: rec.oldValue,
          newValue: rec.target.getAttribute(rec.attributeName),
        });
      }
    }

    // Deduplicate consecutive text changes on the same target — keep only the
    // last value for each target path within this batch (the final state of
    // a streaming burst matters more than every intermediate token).
    var textByTarget = new Map();
    var deduped = [];
    for (var j = changes.length - 1; j >= 0; j--) {
      var c = changes[j];
      if (c.kind === "text") {
        if (!textByTarget.has(c.target)) {
          textByTarget.set(c.target, true);
          deduped.unshift(c);
        } else {
          // Merge: use this earlier entry's oldValue with the later entry's newValue.
          var later = deduped.find(function (d) { return d.kind === "text" && d.target === c.target; });
          if (later && c.oldValue) later.oldValue = c.oldValue;
        }
      } else {
        deduped.unshift(c);
      }
    }

    return deduped;
  }

  // -------------------------------------------------------------------------
  // Observer
  // -------------------------------------------------------------------------

  var observer = new MutationObserver(function (records) {
    if (!recording) return;
    pendingRecords.push.apply(pendingRecords, records);
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

  // -------------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------------

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg) return;

    if (msg.type === "PING") {
      sendResponse({ alive: true, recording: recording, url: location.href });
      return;
    }

    if (msg.type === "SET_RECORDING") {
      recording = msg.recording;
      if (recording) {
        // Starting a new session — send an initial snapshot.
        pendingRecords = [];
        textNodeHistory.clear();
        try {
          chrome.runtime.sendMessage({
            type: "SESSION_START",
            timestamp: new Date().toISOString(),
            url: location.href,
            title: document.title,
            outline: snapshotOutline(document.documentElement),
          });
        } catch (_) {}
      } else {
        // Flush any remaining mutations before stopping.
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        flushBatch();
        try {
          chrome.runtime.sendMessage({
            type: "SESSION_END",
            timestamp: new Date().toISOString(),
            url: location.href,
            title: document.title,
            outline: snapshotOutline(document.documentElement),
          });
        } catch (_) {}
      }
    }

    if (msg.type === "REQUEST_SNAPSHOT") {
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
