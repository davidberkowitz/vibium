# roadmap.md

## Cycle 1 — 30 days from 2026-07-16 — **CLOSED 2026-09-13**

Built from the evidence in mirror.md / evidence.md. Every item has a receipt and a first
action. The theme is one sentence: **the work is already done; only the last step is
missing.** ~3,300 finished lines are stranded on branches no one has ever seen.

---

## This week (by 2026-07-23) — unstrand the finished work

1. **Merge doc-change-logger and vault to main.**
   Receipt: finished 2026-02-08 / 2026-07-05, zero movement since.
   First action: one sentence to any Claude session — "Merge the doc-change-logger and
   vault branches to main." You never touch git. (Or click "Merge" on a PR if one is open —
   no terminal involved.)
2. **End the insurance-card limbo. — DECIDED 2026-07-21: abandoned.**
   Receipt: one commit 2026-04-01, untouched 106 days, no evidence of use.
   The work is recoverable at commit `05a0c81` if ever wanted. The remote branch
   `claude/insurance-card-wallet-QQMPe` still needs one click to delete (session
   git proxy blocks deletions): github.com/davidberkowitz/vibium/branches → trash icon.
3. **Send one link to one person.**
   Receipt: interview 2026-07-16 — zero of three projects ever seen by anyone else.
   First action: pick the extension (it's your best work), have an agent package it, send
   the zip to a single person with one line: "made this, curious what you think."
   This is the entire test of the "unless" gate. One observer. One week.

## This month (by 2026-08-16) — close the loop you opened in February

4. **Use the Doc Change Logger on a real session.**
   Receipt: built 2026-02-08 "to understand the operating principles of the harness";
   redesigned 2026-06-27; never used. The February question is still unanswered.
   First action: one session — "Install the extension in Chromium, record a thinking
   session, and show me screenshots." Your fork is a browser-automation tool; the agent
   can drive the whole test.
5. **Replace the untestable gate with a testable one.**
   Old (retired): "for me only, until/unless it provides value to others."
   New: **every finished project gets exactly one external observer within 7 days.**
   This gate can actually fire.
6. **Adopt the ship-step (`/ship`) as a session-ending habit.**
   Receipt: the record shows a branch not shipped by session's end is never shipped
   (3 of 3). The ship decision must happen inside the burst, while the session is warm.

## Daily / every session — protect what works

7. **Keep the ripen-then-execute rhythm.** Long quiet, then one complete artifact per
   sitting, no WIP. It works (4 of 4 sessions produced finished artifacts). Do not convert
   to a daily-grind cadence; the record says your bursts are healthy.
8. **Keep long-lived sessions.** The 139-day session resume (Feb 8 → Jun 27) preserved
   context a fresh start would have lost.
9. **Keep review-before-build.** "Fix review issues" (19:51) before extending (19:57) —
   protect that reflex.
10. **Last ten minutes rule.** Before any session ends, the agent asks one question:
    "ship or archive?" No third option. No branch enters limbo.

## Rhythm note (low confidence — 4 data points)

Your sessions run weekends and late nights, and they're accelerating: gaps of 52 → 87 →
8 → 11 days. Don't schedule more sessions; schedule the *ending* of each one (item 10).
The hours aren't the problem. The last ten minutes are.

## Scorecard — check on 2026-08-16

| Metric | 2026-07-16 | 2026-08-16 |
|---|---|---|
| Branches merged to main | 0 | |
| External observers of anything you built | 0 | |
| Finished projects you actually use | 0 | |
| Sessions ended with ship-or-archive decided | 0 of 4 | |

---

# Cycle 1 result — scored 2026-09-13 (28 days late, which is itself a finding)

| Metric | 2026-07-16 | 2026-08-16 target | Actual 2026-09-13 | Verdict |
|---|---|---|---|---|
| Branches merged to main | 0 | ≥2 | 15 PRs / 15 merge commits | **beaten** |
| External observers of anything built | 0 | 1 | **0** | **missed** |
| Finished projects actually used | 0 | 1 | loadpath, extended 9× in 4 days | met, in an unexpected form |
| Sessions ended with ship-or-archive decided | 0 of 4 | all | every session since 2026-07-22 landed a merge | met in effect |

Item-by-item: **1 (merge the backlog) — done**, PRs #1, #2, #3 merged. **2 (insurance card)
— decided abandoned, branch still on the remote 165 days later.** **3 (send one link to one
person) — never attempted.** **4 (use the Doc Change Logger on a real session) — never
attempted; the extension has still never been run.** **5 (replace the untestable gate) —
half done:** a testable gate was installed (merge to main) and it fires constantly, but it
is not the audience gate, so the original claim is still untested. **6 (`/ship` as a habit)
— done, and it is the reason for everything in the "beaten" row.** **7–9 (protect the
rhythm, long sessions, review-before-build) — held.** **10 (last ten minutes) — held.**

One line for the whole cycle: **the shipping problem was a missing rule, and writing the
rule fixed it in six days. The audience problem is not the same problem, and nothing in
cycle 1 touched it.**

---

# Cycle 2 — 30 days from 2026-09-13

Theme: **one merge is not one reader.** Cycle 1 proved you will do anything you have
specified; the specification for exposure is still missing. Everything below is either that
specification or protection for the rhythm that made cycle 1 work.

## P0 — this week (by 2026-09-20)

1. **Put loadpath behind a URL and send it to one named person.**
   Receipt: 17 PRs, 0 review comments, 0 observers (metrics §7, GitHub PR list). The app is
   static, zero-dependency and runs from `file://` — it is already deployable; there is no
   technical step left, only the naming of a person.
   First action, in this order, and the order matters: **name the person first**, out loud,
   before any deploy work starts. Then one sentence to any session: "deploy apps/loadpath to
   a static host and give me the link." Then send: *"Built a thing that shows where a
   driver's weight actually goes. 60 seconds, no install: <link>. Curious what you'd
   change."*
   Done means: a URL exists, and one person who is not you has opened it.
2. **Answer the four hand-filled fields, with dates, in the scorecard below.**
   Receipt: `metrics.md` §9 exists precisely because git cannot see them. A dated zero is a
   finding; a blank is a dodge.

## P1 — this month (by 2026-10-13)

3. **Add CI.** `.github/` does not exist and 267 tests only run when someone types
   `make test` — during the fastest week in the record. One workflow, `make test` on push
   and PR. Receipt: evidence §10. Cost: one short session.
4. **Resolve the stale mission statement.** PR #17 (open draft) says `apps/` is a sandbox;
   `CLAUDE.md` still says "Current Goal: V1 by Christmas" with zero lines committed toward
   `V1-ROADMAP.md` in 216 days. Merge #17 and rewrite the goal line to whichever is true:
   a workshop for instruments, or a browser-automation fork you intend to advance. Stale
   goals quietly tax every future session's judgment about what belongs here.
5. **Branch hygiene, one pass.** Eight merged branches and `claude/insurance-card-wallet-QQMPe`
   (165 days, already decided) are still on the remote. `/triage` does this in one sitting.
6. **Re-export the illustrations or rename them.** 16 files in `apps/*/images` are JPEG bytes
   with `.png` names. Trivial — and exactly the class of thing your own debriefs say to fix
   before someone else sees it.

## Protective — do not let cycle 2 break what cycle 1 built

7. **Expect the crash, and plan for a small session instead of none.** Base rate: 4 of 4
   bursts in this record were followed by a gap of 16+ days. Around 2026-09-20, the useful
   session is not a build — it is twenty minutes: `make track`, reread the bottom of
   `mirror.md`, fill the scorecard. If the gap arrives anyway, it is data, not failure.
8. **`make track` becomes the first move of the ship step.** One command, five seconds. The
   July scorecard died of manual maintenance; this one cannot.
9. **Keep, explicitly:** PR-per-milestone; building at night and merging after sleep;
   screenshot verification alongside tests; a LEARNING part per milestone; long-lived
   sessions. These are not habits to optimize — they are the mechanism that produced twelve
   thousand lines in four days.

## Stop doing one thing

10. **Stop letting a merge feel like a ship.** The `/ship` command now requires a link or an
    explicit "nobody, and I accept that" before it will call a session finished
    (`.claude/commands/ship.md`, step 3). If the honest answer is "nobody", say so and move
    on — an acknowledged audience of one is a decision. An unacknowledged one is the thing
    this whole directory exists to catch.

## Scorecard — check 2026-10-13

| Metric | 2026-09-13 | 2026-10-13 | Notes |
|---|---|---|---|
| Merge commits on main | 15 | | generated: `make track` §1 |
| **People who opened something built here** | **0** | | hand-filled, name them |
| People who ran something built here | 0 | | hand-filled |
| Live URLs for anything in `apps/` | 0 | | |
| CI runs | 0 | | |
| Unmerged/undeleted remote branches | 3 unmerged + 8 dead | | generated: `make track` §7 |
| Days since last commit at check time | 0 | | tests H7 (predicted ≥14-day gap) |
| Words of LEARNING.md | 26,044 | | tests H9 (prose vs code) |
