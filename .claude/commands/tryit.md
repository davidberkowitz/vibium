---
description: Install and exercise a finished project, then show the user proof it works
---

The user builds finished tools and then never installs or uses them. This command closes
that gap: the agent performs the "install and use" step and brings back evidence.

Given a project in this repo (ask which one if ambiguous — extension, vault, or other):

1. **Build and install it for real.**
   - Chrome extension: launch Chromium (Playwright is available; use the pre-installed
     browser), load the unpacked extension, open a page that mutates the DOM, record with
     the extension, and capture screenshots of the panel actually working.
   - clicker/vault or other CLI: build the binary, run the real commands end to end
     (init/set/get/list), show real transcript output.
   - Anything else: find the nearest runnable form and run it.
2. **Report with evidence**: screenshots or command transcripts, not claims. If something
   is broken, fix it and re-run — "it should work" is not a result.
3. **End with two lists, three items max each**: what worked, and what the user would hit
   in the first five minutes of real use.
