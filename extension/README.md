# Doc Change Logger — Chrome Extension

Records document structure changes during AI "thinking" — click Record before prompting the AI, and the extension captures every DOM mutation as the response streams in. Previous thinking sessions are kept in collapsible disclosure elements.

## Install (Developer Mode)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked** and select the `extension/` directory
4. Click the extension icon in the toolbar to open the side panel

## Usage

1. Open the side panel (click the extension icon)
2. Navigate to an AI chat interface (Claude, ChatGPT, etc.)
3. Click **Record**
4. Send your prompt — the extension captures DOM changes as the AI responds
5. Click **Stop** when the response is complete (or it auto-stops on page navigation)
6. Previous sessions collapse into `<details>` elements; click to expand

## How It Works

```
Page DOM ──MutationObserver──► content.js ──message──► background.js ──port──► panel (side panel)
```

- **content.js** — Injected into every page. When recording is active, watches DOM mutations via `MutationObserver`. Filters out noise (class/style churn, animation attributes, script/style elements) and coalesces streaming text updates on the same node into a single change. Sends batches every 250ms.

- **background.js** — Service worker that manages per-tab session state (start/end, updates, outlines) and routes messages to the side panel.

- **panel.html / panel.js / panel.css** — Side panel with:
  - **Record/Stop** button with live elapsed-time indicator
  - **Current Document Structure** — live tree view of the page outline
  - **Thinking Sessions** — each recording period is a session. The active session stays open; previous sessions collapse. Within each session, mutation batches are nested `<details>` groups.

## What Gets Captured

| Badge     | Color  | Meaning |
|-----------|--------|---------|
| ADDED     | Green  | New node inserted — shows extracted text content |
| REMOVED   | Red    | Node removed from the DOM |
| TEXT      | Peach  | Text content modified (streaming tokens) |
| ATTRIBUTE | Yellow | Meaningful attribute changed (not class/style noise) |

## What Gets Filtered Out

- `class` and `style` attribute changes (animation/framework noise)
- `script`, `style`, `link`, `svg`, `meta` elements
- Empty text nodes, comment nodes
- `data-radix-*`, `aria-busy`, `tabindex` attribute churn
- Duplicate text changes on the same node within a batch (keeps earliest→latest diff)
