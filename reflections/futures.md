# futures.md — state of the art today, and where it can go

Written 2026-09-13. Part 1 is description and rests on the record (`metrics.md`,
`evidence.md`); it is high-confidence. Part 2 is forecast from a 15-active-day record and is
low-confidence by construction — which is why every scenario below carries an indicator you
can check in days, not months. When one resolves, write down which one and when. A forecast
that is never scored is a horoscope.

---

# Part 1 — The state of the art today

## The loop you are actually running

This did not exist eight weeks ago. It emerged between 2026-09-09 and 2026-09-13 and it
produced 12,129 lines in four days:

```
plan as its own PR  →  milestone (M0…M8) as its own PR  →  merge in the morning, rested
        ↑                        ↓                                    ↓
   plan gets amended      tests + screenshots            a LEARNING part per milestone
   when a milestone          as verification              (nine steps, every time)
   proves it wrong
```

Four properties worth naming, because they are the parts most people get wrong:

1. **The plan is a document under version control, not a chat message.** `apps/loadpath/PLAN.html`
   is 68 KB and was committed *before* M0. Milestones then falsified parts of it, and the
   debriefs record which parts ("The bug the milestone found in the plan").
2. **The merge is a review gate with a sleep in it.** Median latency 5.4 h, clustered
   overnight. The work is written between 17:00 and 23:00 and merged between 06:00 and 10:00.
3. **Verification is two-channel.** 267 automated tests, plus rendered screenshots read by
   eye — and the debriefs are explicit that channel two caught what channel one missed, and
   that one mutation test "lied in the reassuring direction."
4. **Each milestone ends in prose.** 26,044 words of LEARNING.md. The explanation is treated
   as a deliverable, not a byproduct.

## The stack, and what it refuses

| Layer | Choice | The refusal that defines it |
|---|---|---|
| Runtime | Vanilla JS, canvas + SVG, `file://`-openable | **No dependencies, no build step.** `view3d/scene.js` hand-rolls 3D projection in ~100 lines rather than add three.js for one view. |
| Tests | `node --test` | No framework, no runner, no config. |
| Serving | `python3 -m http.server` behind `make` | 31 Makefile targets; the Makefile is the entire UI. |
| Illustration | Nano Banana / Gemini, 16 images | The one place external tooling is allowed in. |
| Agent harness | Claude Code on the web; `Claude-Session` trailer in every commit; `/ship`, `/triage`, `/tryit` | The harness records itself, which is why `track.sh` can reconstruct sessions at all. |
| Self-tracking | `reflections/` + `make track` | Nothing leaves the machine; no service, no API key. |

## Where this is genuinely ahead

Judged against ordinary engineering practice, not against a survey — treat as my assessment,
not as a measured fact:

- **Specification before code, in the repo.** Most agent-assisted work is a chat transcript
  that evaporates. Yours is a committed plan that later gets contradicted in writing.
- **Debrief discipline.** Twenty-six thousand words of "here is the mess and what it taught
  me" is rarer than any code pattern in this tree.
- **Milestone-sized PRs with a mandatory sleep.** This is the single most effective known
  guard against the characteristic failure of agent-assisted building — large, plausible,
  unreviewed diffs.
- **Dependency abstinence.** An app that opens from `file://` in 2026 will still open in 2036.
- **Self-instrumentation.** The session trailer plus `track.sh` means your process can be
  audited from evidence. Almost nobody has this.

## Where it is behind, and the gap is not skill

- **No CI.** 267 tests, zero automation, during the fastest week in the record.
- **No distribution.** Three finished apps, zero URLs. The last mile has no tooling at all,
  which is why it never happens; every other step in your loop has a `make` target.
- **No visual regression.** Screenshots do real work here but are read once by a human and
  never stored as baselines, so a rendering regression is invisible after the session ends.
- **No use telemetry, not even for yourself.** You built three instruments and measure none
  of their use — the oldest finding in this record, still true.
- **No second reader.** Seventeen PRs, zero comments. Every design decision in this tree has
  been reviewed by exactly one person and one model.

---

# Part 2 — Possible futures

Probabilities are calibrated guesses, not measurements. They sum to 100% across A–E because
one of them is what the next thirty days will mostly look like.

## A. The workshop deepens — 45%

loadpath reaches M9…M12 (tyre model, ride comfort metric, a second vehicle), apps/ grows a
fourth instrument, the debriefs pass 40,000 words. Everything gets better and nothing gets
seen. This is the highest-probability future because it is the current trajectory and nothing
in it is unpleasant.

- **Indicator (days):** the next session opens a new milestone rather than a deploy.
- **What it costs:** nothing visible. That is the danger — this future never announces itself
  as a problem.
- **Lever:** cycle-2 item 1. A URL and a name, before the next milestone.

## B. The crash — 25%

The sprint ends the way all four previous bursts ended: a 16-to-88-day silence. September 13
is the fifth day of the heaviest run in the record; commits per day went 3, 7, 3, 9, 2.

- **Indicator (days):** no commit by 2026-09-27 confirms it; any commit before then falsifies it.
- **What it costs:** momentum, and the audience test slips another quarter.
- **Lever:** plan a *small* session for ~2026-09-20 — `make track`, fill the scorecard, twenty
  minutes. A rhythm survives a small session; it does not survive a skipped one.

## C. The audience test finally runs — 15%

One person opens loadpath in a browser. Everything in this directory changes meaning if this
happens, because the claim that gated seven months of non-shipping — "until they provide
value to others" — gets its first measurement.

- **Indicator (days):** a static-host config or a deploy target appears in the tree; or you
  name a person out loud.
- **Why it is only 15%:** it has been the top item on two consecutive roadmaps and has never
  been attempted. Base rate governs.
- **Lever:** the order. Name the person first; deploying without a recipient turns into item A.

## D. loadpath becomes a real thing — 10%

The simulation is already unusual: contact-force splits, exact exponential integration, a
second-order body, an assumptions drawer that shows its own provenance. Aimed at driving
instructors, ergonomics students, sim-racing forums, or a motorcycle-fit audience, it is a
teaching tool people would actually use.

- **Indicator (weeks):** a domain, a landing page, or a README that addresses a stranger
  instead of you.
- **Risk:** this future demands the thing you avoid (audience) *and* the thing you enjoy
  (building), so it can disguise itself as A for months.
- **Lever:** show it to five people before adding a single feature for them.

## E. The mirror becomes the product — 5%

The most distributable artifact in this repository is not an app — it is `reflections/track.sh`.
It is 200 lines of POSIX shell, needs no install, no network and no key, runs against any git
repository, and answers a question a lot of people have ("what does my record actually say
about how I work?"). It is also the only thing here that does not need a deploy step to be
useful to someone else: one gist, one paragraph, done.

- **Indicator (days):** you run it against a repository that is not this one.
- **Why it is low:** it is the newest thing in the tree and you have not used it yet.
- **Lever:** `TRACK_TZ=... sh reflections/track.sh` inside someone else's repo, then ask them
  whether the numbers are right.

## Wildcards, unscored

- **The harness gets a deploy hand.** Agent tooling is adding hosting and monitoring quickly;
  the day "ship it" means a live URL without your involvement, future C stops requiring
  courage and starts being a default. Watch for it and take it.
- **The extension gets used, at last.** Built 2026-02-08 to see how the harness thinks;
  still never run. `/tryit` exists specifically to close this. Its February question is 218
  days old.
- **Prose overtakes code.** 26k words against 22k lines in one week. If the next project's
  debrief outweighs its source, the thing you are really making is the explanation — and
  explanations have readers, which routes straight back to C.

---

## Scoring sheet — fill on 2026-10-13

| Scenario | Called | What actually happened | Notes |
|---|---|---|---|
| A workshop deepens | 45% | | |
| B the crash | 25% | | |
| C audience test runs | 15% | | |
| D loadpath becomes real | 10% | | |
| E the mirror ships | 5% | | |
