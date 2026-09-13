# Learning: how the tracking system got rebuilt

*What happened on 2026-09-13, why it happened that way, and what I'd tell you before you try
something like it. Plain language, coffee not lecture.*

---

## Step 1 — The approach, and why

Your ask had four parts: track what you do using everything available, evolve the system to
new requirements, find the patterns (behavior, actions, energy, time, tools), and say where
this is and where it could go.

The first thing I did was not analysis. It was archaeology. There was already a system here —
`reflections/`, built 2026-07-16 — and the fastest way to say something true was to find it,
read it, and check whether it had held up. It had not: its scorecard was due 2026-08-16 and
was still blank, while the repository had exploded with activity. That single fact set the
whole shape of the work. **The problem wasn't that you lacked a record. It was that your
record was hand-maintained, and hand-maintained records die exactly when the interesting
things happen.**

So the plan became: mine the new evidence, yes — but first build the thing that mines it, so
the mining never has to be redone by hand. Everything after that fell out of one rule I set
early: *no number in any document unless a script produced it.* If I found myself counting
commits by eye, that was a bug in the script, not a reason to count faster.

The starting point in the data was git, for a specific reason that is yours, not mine: your
own epistemology is "captured behavior beats self-report." Commits, timestamps, merge
parents, session trailers and branch topology are captured behavior. Interviews are not.

## Step 2 — Roads not taken

**Writing one big analysis document and calling it done.** This is the obvious move and it's
what July did. It fails the same way twice: the moment it's written it starts aging, and
nobody rewrites a 2,000-word essay to update one number. Rejected because the failure mode
was already on file.

**Instrumenting your future sessions instead of reading your past ones.** Tempting —
keystroke logs, tool-call traces, session transcripts. Rejected for three reasons: the data
doesn't exist yet (so no answer today), the July constraint on file says nothing leaves the
machine, and the past record was already rich enough to be conclusive about the one thing
that mattered.

**Sending the data to Gemini and ChatGPT for triangulation**, which your standing preferences
ask for. I deliberately did not, and flagged it instead. Your 2026-07-16 constraint is
recorded in `evidence.md`: "Everything stays on this machine. Never send session data to any
external service." Two of your instructions collide there, and the conservative read wins by
default — a privacy constraint is easy to relax on request and impossible to un-break. The
image prompts went out; your behavioral record did not.

**Judging the work instead of the pattern.** There's a version of this report that reads as a
performance review. It would have been easy and it would have been worthless — you didn't ask
whether the work is good (it visibly is), you asked what the record says. Every judgment in
the final documents is anchored to a receipt: a SHA, a PR number, or a dated absence.

**Rewriting the July documents.** Rejected. Old readings stay on the page so they can be
checked, and so a wrong call in July is still visible in September. Everything new is
appended and dated. A record you edit is a story; a record you append to is evidence.

## Step 3 — How the pieces connect

Six artifacts, and the order matters:

```
track.sh  ──emits──▶  metrics.md  ──feeds──▶  evidence.md  ──distills──▶  mirror.md
   ▲                   (generated)             (facts + receipts)          (the portrait)
   │                                                   │                        │
make track                                             └──────────┬─────────────┘
(one command,                                                     ▼
 session-end ritual)                                    roadmap.md + futures.md
                                                        (what to do, what might happen)
```

`track.sh` is the only thing that touches git. `metrics.md` is generated and is explicitly
marked "do not hand-edit," which stops the classic rot where someone tweaks a number and now
nothing reconciles. `evidence.md` is where numbers become facts with receipts and hypotheses.
`mirror.md` is where facts become a portrait someone can actually read. `roadmap.md` turns
the portrait into next actions; `futures.md` turns it into forecasts with dates attached.

And one loop closes it: the forecasts in `futures.md` and the hypotheses in `evidence.md`
both get *scored* at the next pass. That's what makes it a system rather than a series of
essays — the September document can be proven wrong in October by the same script that wrote
its numbers.

## Step 4 — Tools, and why these

**POSIX shell for the instrument.** Not Python, not Node, no dependencies. Reason: it has to
run in three years without an install, which mirrors the discipline already visible in your
apps (an app that opens from `file://` in 2026 still opens in 2036). It also means the
instrument is portable enough to be useful to someone else — which quietly made it the most
distributable thing in your repository.

**git as the only source.** Every other data source I considered (GitHub API, session
transcripts, file mtimes) either needs the network, needs credentials, or lies. Git is local,
complete, and timestamped. I used the GitHub API once — to read pull request states and
confirm there were no review comments — and treated that as supplementary rather than
foundational, because the "zero comments" claim is a claim about absence and deserves a
second source.

**The `Claude-Session` commit trailer as the session key.** This was the lucky break. Every
commit your harness makes carries a session URL, which means sessions can be reconstructed —
count, wall span, lines touched — without any logging infrastructure at all. It's how the
82-hour session and the four-day sprint became visible. Worth knowing: you built a Chrome
extension in February to capture how the harness thinks, and the trailer does more of that
job than the extension ever has.

**Timezone handling in `date`, not in my head.** All the raw timestamps are UTC; every
behavioral claim about your hours needs local time. `TZ=America/Los_Angeles` in the script
means the clock analysis is reproducible and re-runnable somewhere else (`TRACK_TZ=...`).
Guessing the offset — as the July pass did, it guessed US-Central — would have put the
"sleep-gated merge" pattern an hour or two off and possibly invented it.

If I'd picked differently: Python would have made the script prettier and less portable;
skipping the script entirely would have produced this report two hours sooner and nothing in
October.

## Step 5 — Tradeoffs, both sides

- **Generated numbers vs. narrative numbers.** Generated ones can't drift, but they're blunt:
  the script can tell you a branch has no merge commit on main, and it cannot tell you that a
  squash merge already landed the content. I handled it by making the script say *"verify
  whether a squash merge landed it"* instead of asserting. Cost: a slightly hedged line.
  Benefit: the file never lies.
- **Append-only vs. readable.** `evidence.md` and `mirror.md` will get long. A reader in 2027
  will have to scroll past two dead compilations to reach the live one. I took that cost
  because the alternative — a tidy file that quietly loses its own history — is worse for a
  record whose whole purpose is checking old claims.
- **Four zeros stated bluntly vs. softened.** I kept them blunt, including in the artifact
  title. The softened version reads better and lands nowhere.
- **Two illustrations, not eight.** Generated images are decoration unless they carry an idea;
  I made exactly two ideas worth an image (the two clocks; the excellent thing nobody came to
  see) and drew everything data-bearing as real charts instead.
- **Depth on this repository vs. breadth across your work.** I only see this repo. Anything
  you do elsewhere is invisible here, and I said so rather than generalizing to "how you
  work" in the abstract.

## Step 6 — The mess

Plenty, and it's the useful part.

**The commit count was wrong twice.** My first script counted 44 commits, 31 work and 13
merges. A hand-check in Python said 45, 30 and 15. The bug: I filtered upstream commits out of
the *total* but not out of the *merge count*, so the subtraction produced a number that was
wrong in both directions at once. Lesson that generalizes: **when two numbers in a table are
derived from each other, derive them from the same filtered set or they will disagree in a way
that looks like a rounding error and isn't.**

**The gap column printed em-dashes for every row.** I'd nested a `date` subshell inside an
awk `getline` and the quoting collapsed. The fix wasn't cleverer quoting — it was moving the
date arithmetic out of awk and into the shell loop where it belonged. Clever nesting in shell
is almost always a bug in waiting.

**The stale local `main`.** The container's `main` ref was 11 commits behind the remote, so
the first run reported three merges when there were fifteen. Everything downstream — "stranded
branches," "merged work" — was wrong in a way that *looked* plausible, which is the dangerous
kind. The script now fetches and prefers `origin/main`. If you take one paranoid habit from
this: an analysis of "what shipped" that never fetched is an analysis of what shipped *as of
whenever this checkout was made*.

**The chart annotation ran off the right edge** of the cadence chart, which I caught on the
one screenshot I took before publishing. Charts are the thing most worth looking at, because
label collisions are invisible in code and obvious in a picture.

**A command file lost a step.** When I edited `ship.md` to add the `make track` step, my
string replacement swallowed step 1. Caught it on the read-back. Editing by exact-string
replacement is safe right up until the string you match spans a boundary you didn't mean to
cross.

## Step 7 — Pitfalls, the "wish I'd known" list

1. **Local git refs lie.** Fetch before you count anything about "what's on main."
2. **A squash merge erases the ancestry it shipped.** Any "unmerged branches" metric will
   over-report unless you check pull request state too.
3. **Timezones decide behavioral conclusions.** "He works late" and "he works mornings" can be
   the same data read in two offsets. Pin the timezone, and say which one you used.
4. **Absence needs two sources.** "Nobody ever commented" isn't in git at all. I checked the
   GitHub PR list for it, and I'd treat a single-source zero as a hypothesis, not a fact.
5. **Exclude the upstream author everywhere, or nowhere.** A fork's history is two people's
   work wearing one hat.
6. **The instrument's own output is data.** That `reflections/` went untouched for eight weeks
   was one of the most informative facts I found, and it was sitting in `git log -- reflections/`.
7. **Generated files need a "do not hand-edit" line at the top.** Someone will otherwise fix a
   number by hand, and then nothing reconciles ever again.

## Step 8 — What an expert notices that a beginner misses

A beginner reads this record and says: *he shipped fifteen pull requests, huge improvement,
problem solved.* An expert looks at the same data and asks what the metric is standing in for.
Merging to a repository only you read is not distribution — it's filing with extra steps. The
number that moved was the proxy; the number the proxy was invented to approximate did not move
at all. This is the most common way good measurement goes wrong: you hit the target and miss
the point, and because the target is genuinely easier, the impulse that used to produce
tension now discharges harmlessly.

Two more expert-eye things in this specific record:

**The fix was a rule change, not an effort change.** Six days after reading a document that
named the missing step, you rewrote `CLAUDE.md` so the step couldn't be skipped, and seven
months of stalling ended. That tells you the stall was a specification bug, not a motivation
bug — and it predicts that *every* remaining gap here is also a specification bug. That's why
the roadmap's headline item isn't "try to share your work," it's "name the person before you
start."

**The merge latency distribution is bimodal for a reason.** Five to ten hours, over and over,
looks like indecision until you plot it against the clock and see it's a night's sleep. A
beginner reports the median. An expert notices the shape and finds the mechanism — and then
tells you to protect it, because "write hot, merge cold" is a review process most teams pay
consultants to install.

## Step 9 — What transfers to completely different work

- **When a habit fails repeatedly, suspect the specification before the person.** The July
  finding wasn't "he lacks discipline" — the man wrote 267 tests. It was "the last step was
  never written down." That reframe generalizes to teams, processes and products: if a step is
  skipped by competent people every single time, the step is under-specified or unowned.
- **Automate the measurement before you promise the behavior.** Any metric a human has to
  refresh by hand will go stale precisely during the period it would have been most
  interesting. One command, five seconds, wired into a ritual you already perform.
- **Count what didn't happen.** The strongest findings here are all zeros — no reader, no CI,
  no deploy, no commit toward the fork's stated goal. Presence gets recorded automatically;
  absence has to be looked for on purpose.
- **Score your forecasts.** A prediction with a date and a falsifier teaches you something in
  a month. A prediction without one is entertainment.
- **Two claims from the same person can both be sincere and mutually exclusive.** "Keep
  everything local" and "triangulate with other models" are both true preferences. The move
  isn't to pick silently — it's to do the part that's unambiguous, name the collision, and let
  the person decide.
- **Distribution is a skill, and it is a different skill from building.** Everything in this
  repository that has tooling gets done. The one step with no tooling — putting a finished
  thing in front of a person — has never once been done. That's not a character trait. That's
  a missing `make` target.
