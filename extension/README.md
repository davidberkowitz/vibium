# Doc Change Logger — Chrome Extension

Monitors DOM mutations in real time and presents them in a side panel, capturing the "thinking" of AI agents as they modify the page.

## Install (Developer Mode)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked** and select the `extension/` directory
4. Click the extension icon in the toolbar to open the side panel

## How It Works

```
Page DOM ──MutationObserver──► content.js ──message──► background.js ──port──► panel (side panel)
```

- **content.js** — Injected into every page. Watches the DOM with a `MutationObserver` (childList, attributes, characterData, all with subtree). Mutations are batched (300ms debounce) and sent to the background service worker along with a compact document outline snapshot.

- **background.js** — Service worker that stores per-tab change logs and routes messages to the side panel via a long-lived port.

- **panel.html / panel.js / panel.css** — Side panel UI with two sections:
  - **Current Document Structure** — Live tree view of the page outline (tags to depth 4).
  - **Change History** — Chronological log of mutation batches. Each batch is a `<details>` disclosure element: the most recent entry is open, previous entries collapse automatically. Each individual change shows a color-coded badge (added/removed/attribute/text), the DOM path, and relevant values.

## Panel Controls

| Button  | Action |
|---------|--------|
| Refresh | Requests a fresh DOM snapshot from the content script |
| Clear   | Clears the change history log |
| Pause   | Stops rendering incoming changes (content script still observes) |

## Change Types

| Badge     | Color  | Meaning |
|-----------|--------|---------|
| ADDED     | Green  | New node inserted into the DOM |
| REMOVED   | Red    | Node removed from the DOM |
| ATTRIBUTE | Yellow | Element attribute changed |
| TEXT      | Peach  | Text content modified |
