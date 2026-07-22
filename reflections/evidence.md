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
