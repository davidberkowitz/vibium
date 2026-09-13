---
description: Update the behavioral record — regenerate the metrics, then say what changed and what it means
---

Maintain `reflections/` — the record of how this person actually works, built only from what
they actually did. Self-report is not evidence here unless a log agrees with it.

1. **Regenerate, do not recount.** Run `make track` (writes `reflections/metrics.md`). Every
   hard number in the system comes from that file; if you find yourself counting commits by
   hand, stop and fix the script instead.
2. **Read the last compilation** at the bottom of `reflections/evidence.md` and the
   hypotheses it ends with. Those are predictions. Score them: confirmed, falsified, or still
   open, each with a receipt (commit SHA, PR number, or a dated absence).
3. **Append — never rewrite.** A new dated compilation goes at the end of `evidence.md`; a new
   dated pass goes at the end of `mirror.md`. Old readings stay on the page so they can be
   wrong in public. State the confidence level and what the record cannot see.
4. **Prefer absence as data.** The most load-bearing findings in this directory are zeros:
   zero external observers, zero CI runs, zero deploys. Count what did not happen.
5. **Surface contradictions between what is said and what is logged**, plainly and without
   moralizing. One sentence each, with the receipt.
6. **Update `roadmap.md`:** score the open cycle's scorecard (generated rows from
   `metrics.md`, hand-filled rows dated even when the answer is zero), then set the next
   cycle's items — each with a receipt and a first action small enough to do in one sentence.
7. **Score the forecast.** `futures.md` carries probabilities and indicators. Mark what
   resolved. An unscored forecast is a horoscope.
