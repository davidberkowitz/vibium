---
description: Put a finished static app behind a real URL, so "who gets the link?" has an answer
---

The gap this closes: every app in `apps/` is finished, tested, documented — and reachable
only at `localhost`. In this repo's whole history, zero people other than the author have
opened anything built here, and the missing piece has never been courage or code. It has been
a URL.

Given an app (ask which if ambiguous — currently `gridprobe`, `mindmap`, `loadpath`):

1. **Check it is actually static.** These apps are zero-dependency and open from `file://`;
   there is no build step to run. Confirm by opening `index.html` and listing the local
   scripts it loads. If something needs a server or a key, say so and stop.
2. **Ask once, before deploying:** "This puts <app> on the public internet at a URL anyone
   with the link can open. Go ahead?" Deploying is outward-facing and hard to take back —
   never do it on your own initiative. If the answer is no, stop; offer a zip instead.
3. **Deploy the directory as-is** to whichever static host is available in the session
   (a Netlify connector, GitHub Pages from `apps/<name>/`, or any equivalent). Do not
   restructure the app to suit the host.
4. **Verify like a stranger would.** Open the live URL in a browser, exercise the main
   interaction, and take one screenshot. A deploy that 404s on a script path is the normal
   failure here — check the network panel, not just the homepage.
5. **Hand back three things:** the URL, the screenshot, and a one-line message the user can
   paste to one person. Keep the message about what the thing shows, not how it was built.
6. **Write it down.** Add the URL and the date to the scorecard in `reflections/roadmap.md`,
   and note who it was sent to. That row is the only place in this system where the audience
   number can go up.
