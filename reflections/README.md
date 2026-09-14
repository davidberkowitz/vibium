# reflections/ — the tracking system

A record of how one person actually works, built only from what that person actually did.
No self-report is admitted as evidence unless a log agrees with it.

Started 2026-07-16 (one interview + git archaeology). Evolved 2026-09-13: the counting is
now a script, so the record can no longer fall out of date while the work accelerates.

## The files, and what each one is for

| File | Kind | Answers |
|---|---|---|
| `metrics.md` | **generated** — never hand-edit | What happened, in numbers. Volume, sessions, rhythm, clock, merge latency, stranded branches. |
| `track.sh` | instrument | Regenerates `metrics.md` from git alone. No network, no API key, nothing leaves the machine. |
| `evidence.md` | append-only log | Dated compilations of facts with receipts (commit SHAs, PR numbers), plus hypotheses for the next pass. Each compilation states its own confidence. |
| `mirror.md` | append-only | The portrait. Prose, written to be reread later and checked against reality. Never rewritten — a new pass is appended so old readings stay falsifiable. |
| `roadmap.md` | working doc | What to do next, each item carrying a receipt and a first action. Holds the scorecard. |
| `futures.md` | working doc | State of the art today, and the possible futures with their leading indicators. |
| `LEARNING.md` | debrief | How this system was built and why, in plain language. |

## How to run it

```
make track                      # regenerate reflections/metrics.md, print the volume table
sh reflections/track.sh          # same, to stdout
TRACK_OFFLINE=1 sh reflections/track.sh   # skip the git fetch
TRACK_TZ=Europe/Berlin make track         # recount the clock in another timezone
```

Sample output (2026-09-13):

```
| Commits authored under this fork | 44 (31 work, 13 merge) |
| Days with any commit | 15 |
| Duty cycle (active days / span) | 6.9% |
| Merge commits on main | 14 |
```

## Cadence

- **Every session end** — `make track`. One command, five seconds. This is the whole
  maintenance burden; the July version of this system had a manual scorecard and it went
  eight weeks without being filled in during the most productive stretch on record.
- **Monthly** — reread `mirror.md` bottom-up, check the scorecard in `roadmap.md`, append a
  new compilation to `evidence.md` if anything in the portrait has gone stale.
- **When a prediction in `futures.md` resolves** — write down which one, and when. A scenario
  that was assigned a probability and then happened (or didn't) is the only way this system
  earns the right to make the next forecast.

## The one rule

`track.sh` measures what git can see. Git cannot see whether another human ever opened
anything built here — and that is the number the whole record turns on. Section 9 of
`metrics.md` lists those fields and leaves them blank on purpose. They get answered by hand,
with a date, in the scorecard in `roadmap.md`. A blank is a finding, not an oversight.
