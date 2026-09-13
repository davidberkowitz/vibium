# evidence.md — vibium fork, davidberkowitz
Compiled 2026-07-16. Scope: the only records on this machine — the vibium fork's git
history and this session. All timestamps UTC unless marked. CONFIDENCE: LOW-MODERATE
(user's own record = 4 prior sessions + today; under the 20-session threshold, stated per rule).

## Provenance (load-bearing fact)
- Fork of upstream vibium. All 105 main-line commits (2025-12-11 → 2025-12-24) are the
  upstream author's, not the user's. Excluded from all user-pattern claims.
- The user's entire record here: 3 unmerged `claude/*` branches (5 commits, all
  Claude-session-authored) + this session.
  - 2026-02-08 18:34 — "Add Doc Change Logger Chrome extension" (1,355 lines: MutationObserver
    → side panel "as a way to visualize AI 'thinking'")
  - 2026-04-01 04:56 — "Add iOS app for digital insurance card with Apple Wallet support" (1,133 lines, SwiftUI/PassKit)
  - 2026-06-27 19:51 — "Fix review issues in Doc Change Logger extension"
  - 2026-06-27 19:57 — "Redesign extension around AI thinking capture"
  - 2026-07-05 00:33 — "Add encrypted secrets vault (clicker vault)" (828 lines incl. 201 lines of tests)
  - 2026-07-16 — this session: a request to mine his own agent logs for a self-portrait.

## 1. Recurring themes
- **Instruments for watching AI think.** 3+ occurrences: forked vibium, a browser-automation
  tool for AI agents (fork point 2025-12-24); built the Doc Change Logger "to visualize AI
  'thinking'" (2026-02-08); returned to redesign it as a "thinking session recorder"
  (2026-06-27); today asked an agent to read its own session logs back as a mirror
  (2026-07-16). Four dated receipts, one subject: making the machine's inner process visible.
- **Trust hygiene / personal data under own control.** 3 occurrences: encrypted local vault
  "instead of dotfiles… never argv, so they stay out of shell history" (2026-07-05); digital
  insurance card kept in own app/wallet (2026-04-01); today's constraint "Everything stays on
  this machine. Never send session data to any external service" (2026-07-16).
- **Signal-vs-noise filtering.** The 2026-06-27 redesign body is one long noise-reduction
  spec: "only captures mutations when recording, so the panel isn't flooded", "Filter out
  noise", "Coalesce streaming text updates". Today's brief: "5 true patterns beat 20
  plausible ones." 2 strong receipts + this session — counted with caution.

## 2. Abandonment graveyard
- **3 branches, 0 merges, 0 releases.** Every project reached "complete with README and
  tests" and stopped at the branch. Nothing ever landed on the fork's main, which is frozen
  at upstream's 2025-12-24 commit.
  - insurance-card-wallet: 1 commit (2026-04-01), never touched again — 106 days idle.
  - secure-api-key-vault: 1 commit (2026-07-05), unmerged — includes a full test suite
    (roundtrip, tamper detection, permissions) that has likely never run in CI or on main.
  - doc-change-logger: the ONLY project ever returned to (2026-02-08 → 2026-06-27,
    a 139-day gap), still unmerged.
- **The fork itself**: never synced with upstream after forking; no issues, no PRs, no
  README edit, no commit by the user's own git identity anywhere.

## 3. Correction patterns
- Partial data (no transcripts of the working sessions survive here).
- One receipt: 2026-06-27 19:51 "Fix review issues" immediately before the 19:57 redesign —
  he reviews the agent's work and demands fixes before building further.
- What the redesign fixed says what he cares about: noise filtered, events grouped into
  sessions with timestamps and duration, streaming updates coalesced, state that survives
  reopening ("Hydrate session history when panel is re-opened"). Legibility over features.
- INSUFFICIENT DATA for a 3+ pattern.

## 4. Repetition tax
- INSUFFICIENT DATA for classic repetition (no transcripts).
- One structural candidate, 3 receipts: the step after "it works" — merge, publish, put it in
  front of anyone — was skipped on all three projects (2026-02-08, 2026-04-01, 2026-07-05).
  The repeated cost is not a task he redoes; it is a step he re-skips.

## 5. Rhythm
- All activity in single-session bursts, roughly monthly, accelerating: 2026-02-08 →
  2026-04-01 (52d) → 2026-06-27 (87d) → 2026-07-05 (8d) → 2026-07-16 (11d).
- Clock (UTC; local TZ unknown — if US-Central like upstream, subtract 5–6h): Sun 18:34,
  Wed 04:56, Sat 19:51, Sun 00:33. Reads as weekends and late nights — hobby hours, not
  work hours. 4 data points: LOW confidence.
- Mode of work: each session produces one complete, polished artifact in a single sitting
  (icons, README, tests included) — no half-commits, no WIP commits, ever.
- Notable: the 2026-06-27 commits carry the same Claude session URL as 2026-02-08 — he kept
  one session alive 139 days and resumed it rather than starting fresh.

## 6. Blind spots (absence as data)
- **No shipping.** Zero merges, zero releases, zero users implied anywhere. Three finished
  artifacts sit on branches only their author has seen.
- **No vibium.** He forked a browser-automation project and, in 7 months, never used a
  session to advance its actual purpose (the vault is a CLI adjunct; the extension and iOS
  app are unrelated). The fork functions as a workshop, not a contribution.
- **No collaboration trace.** No co-authors besides Claude, no issue threads, no review
  from another human anywhere in his record.
- **No failure trace.** Every commit is a success commit. Whatever was tried and didn't
  work was never committed — the record self-selects for finished things.

## Phase 3 log (2026-07-16)
- H1 (instruments to understand AI, self-directed): CONFIRMED. "All sessions mine. I wanted
  to capture the actions taken to better understand the operating principles of the harness."
- H5 (return to doc-logger driven by ripened idea, not event): PARTIAL. "I honestly don't
  remember. But I think I had a more fully formed idea of what I needed." Did not answer
  what happened after the 19:57 commit; record says nothing did.
- H2 (nothing ever exposed to another person): CONFIRMED. "No" — zero of three projects
  seen or used by anyone else.
- H4 (audience of one, public-grade polish): CONFIRMED with structure revealed. "For me
  only — until/unless they provide value to others." Shipping is gated on a condition
  (value to others) that cannot fire while audience = 0.
- Q5 (mechanism of the "unless"): the path to others routes back through himself — "I would
  need to install and use and then address any new thoughts / requirements." Note: the
  record shows no evidence even of self-use — no post-completion fix commits on any project
  (doc-logger: silent since 2026-06-27 19:57; vault: since 2026-07-05 00:33).
- Net contradiction on file: an epistemology of "behavior over self-report" (H1, today's
  brief) coexisting with a shipping condition that is itself an untested self-report.

---

# Compilation 2 — 2026-09-13

Scope: the fork's full git history through 2026-09-13, the 17 pull requests on
github.com/davidberkowitz/vibium, and the working tree. All hard numbers in this
compilation are generated by `reflections/track.sh` (`make track` → `metrics.md`) — none
were counted by hand. CONFIDENCE: MODERATE (15 active days, 45 commits, 5 sessions
identified by commit trailer; still no session transcripts, so intent is inferred from
artifacts). Local clock: America/Los_Angeles, now confirmed by merge-commit offsets
(−0700) rather than guessed.

## 0. The headline: every zero in the 2026-07-16 scorecard moved except one

| Metric | 2026-07-16 | 2026-09-13 |
|---|---|---|
| Branches merged to main | 0 | 15 merged PRs, 15 merge commits |
| Finished projects the author returned to | 1 of 3 | loadpath, nine times in four days |
| Commits under the author's own git identity | 0 | 6 |
| External observers of anything built here | 0 | **0** |

## 1. The gate opened six days after it was named
- 2026-07-21 17:29–17:34 PT, session_01V4Eqh53m, three commits: `d34e0bc` merged the vault
  branch to main (the first merge in the fork's user history), `c5f1882` wrote the session
  rules into CLAUDE.md and added `/ship`, `/triage`, `/tryit`, `b509d3d` recorded the
  insurance-card decision as abandoned.
- Read the order: he did not just do the missing step, he **rewrote the harness so the step
  could not be skipped again** — "the agent owns ALL git mechanics", "last ten minutes rule:
  ship or archive", "who gets the link?", "finished means used". The behavior change is
  downstream of a rule change.
- Backlog cleared a month later: PR #2 (opened 2026-07-17) and PR #3 (opened 2026-07-22)
  both merged 2026-08-21/22 — 36 and 31 days of latency, the last of the old pattern.

## 2. Merge latency collapsed by three orders of magnitude
Receipt: `metrics.md` §5. July–August: 17 d, 31 d. September (PRs #6–#16): 0.0 h, 8.6 h,
0.0 h, 2.2 h, 10.0 h, 8.5 h, 2.0 h, 0.3 h, 5.9 h, 5.4 h, 8.9 h — median ≈ 5.4 h, two under
three minutes. Shipping went from a thing he might do later to a thing that happens inside
the same sitting.

## 3. The unit of work inverted
- 2026-02-08: one commit, 1,355 lines, "Add Doc Change Logger Chrome extension" — a whole
  project in one drop, unmerged for 195 days.
- 2026-09-09 → 09-13: a plan PR, then M0–M8 as nine separate PRs of 700–1,700 lines each,
  every one merged before the next opened (`6f36328` … `27f5b22`).
- Same appetite for completeness, one level finer. He did not learn to ship by shipping less
  polished work; he learned to cut the work into pieces that each deserve a merge.

## 4. "I am not comfortable in using git" is now contradicted by the record
Six commits are authored by `davidberkowitz2002@gmail.com`, not by Claude: `6f36328`,
`a1fdf6f`, `c5e6621`, `3fdc292`, `b1e2ee6`, `20c78e3` (2026-09-09 22:11 → 2026-09-10 20:45
PT, the M0–M3 stretch). Authorship reverts to Claude for M4–M8 — a config difference, not a
capability one. The July explanation for seven months of non-shipping has outlived its truth.

## 5. New pattern: the sleep-gated merge (energy + time)
Receipt: `metrics.md` §4 and §5. Building clusters in the evening — 17:00 PT (8 commits) and
20:00–23:00 PT (12). Merges cluster at 06:00–10:00 and 15:00–18:00 PT. The five- to
ten-hour latencies are not hesitation; they are a night's sleep. He writes hot and merges
cold. Saturday is the heaviest day (12 commits), Thursday and Friday next (8 each) — but
September ran seven days straight, so the weekend-hobby shape has broken.

## 6. Energy is detonated, not distributed
Duty cycle 6.9%: 15 active days in a 216-day span. One session (session_01VrVRQcG8, the
loadpath run) spans 82.1 wall hours and 13 commits, +12,129/−419 lines — more code than the
previous six months combined. Commits per day escalate through the run: 3, 7, 3, 9, 2.
Historical precedent says what follows a burst is silence: gaps of 51, 88, 27 and 16 days
all sit immediately after a finished artifact.

## 7. Verification widened from tests to eyes
267 test cases across 20 files; loadpath alone has 198 across 8. New and more interesting:
the debriefs document screenshots catching what tests could not — `apps/loadpath/LEARNING.md`
part nine §5, "The bug a screenshot caught that seven tests missed", and part eight §3, "What
the render actually showed, which is the whole point of rendering it". A mutation test that
"lied in the reassuring direction" (part nine §6) is named as a failure of the test, not of
the code. This is the instrument-maker's epistemology applied to his own instruments.

## 8. Writing became the third artifact
26,044 words of `LEARNING.md` exist in this tree — 22,531 of them for loadpath, in ten
parts, one per milestone, each following the same nine-step structure. Volume of prose now
rivals volume of code. Nothing in the record before 2026-09-06 looks like this.

## 9. The tool signature hardened
- **Zero runtime dependencies, no build step, runs from `file://`.** `apps/loadpath/js/view3d/scene.js`
  opens by refusing three.js for a 3D view and hand-rolling ~100 lines of projection in the
  SVG language the other views already speak, explicitly to keep that promise.
- `node --test` for tests, `python3 -m http.server` for serving, **the Makefile as the only
  user interface** (31 targets; every app gets `make <app>` and `make test-<app>`).
- Illustration outsourced to Nano Banana / Gemini: 16 generated images in `apps/*/images`.
  (Hygiene: they are JPEG bytes with `.png` names.)
- The harness records itself now — every commit carries a `Claude-Session` trailer, which is
  how `track.sh` can group sessions at all. Note the irony: the Chrome extension he built in
  February *to capture AI thinking* is still unmerged and unused, while the thing that
  actually captures his sessions is a one-line commit trailer he did not have to build.

## 10. What is still exactly zero
- **No other human anywhere in the record.** 17 PRs, all self-opened; no review comments, no
  collaborators, no issues, no forks, no discussion. "Merge to main" is now automatic;
  "show it to a person" has still never happened once.
- **No CI.** `.github/` does not exist. 267 tests run only when someone remembers to type
  `make test` — during the fastest-moving week in the record.
- **No deploy.** Every app is a `localhost:808x` away from being a link, and no target,
  config, or host exists to close that gap.
- **No vibium.** Zero lines toward `V1-ROADMAP.md` in 216 days. This is now formalized rather
  than resolved: open draft PR #17 declares `apps/` a sandbox exempt from the project's
  rules, while `CLAUDE.md` still reads "Current Goal: V1 by Christmas."

## 11. Small loops left open (each is minutes of work)
- `claude/insurance-card-wallet-QQMPe` still on the remote 165 days after being recorded as
  abandoned; roadmap item 2 from July called for one click.
- Eight merged branches never deleted (`metrics.md` §7).
- PR #17 sitting open as a draft — the one PR in the record that states the truth about what
  this repository is for.

## 12. The system watching him stopped watching
`reflections/` was untouched between 2026-07-22 and today. The scorecard due 2026-08-16 was
never filled in — during the eight weeks that produced the best numbers in the record. A
record kept by hand does not survive a sprint. Fixed this compilation: `track.sh` +
`make track` regenerate the numbers in one command, and `README.md` makes it the session-end
ritual.

## Hypotheses for the next pass
- **H6 — The gate moved, it did not open.** Merging to main now discharges the shipping
  impulse, and "merge" is cheaper than "audience". Prediction: 30 more days produce more
  merges and still zero external observers, unless one specific person is named *before*
  the work starts. Test: the hand-filled fields in the scorecard on 2026-10-13.
- **H7 — The crash follows the sprint.** Prediction: a gap of ≥14 days after 2026-09-13.
  Falsified by any commit before 2026-09-27. (Historical base rate: 4 of 4 bursts were
  followed by a gap of 16 days or more.)
- **H8 — loadpath is the first thing he wants for itself.** It is the only project ever
  extended nine times. Prediction: it reaches a natural end (M9/M10) and either gets a URL
  or becomes a permanent workshop. Watch which.
- **H9 — Writing is becoming the real output.** 26k words in one week against 22k lines of
  code. If the next project's LEARNING.md outweighs its source, the artifact he is actually
  making is the explanation, not the app.
