---
description: End-of-session ship step — merge finished work to main, no git required from the user
---

The user is finishing a work session. Finished work must not be left stranded on a branch —
in this repo's history, a branch not shipped by session's end was never shipped.

Do the following:

0. Run `make track` first. It regenerates `reflections/metrics.md` from git in about five
   seconds. Quote two lines back: merge commits on main, and unmerged remote branches.
1. Show a one-paragraph summary of what this session built and its current branch.
2. Ask exactly one question: **"Ship or archive?"** Offer no third option. If the user
   answers "ship":
   - Merge the current branch into main (fast-forward or merge commit, whichever is
     cleaner) and push main.
   - Delete the merged branch.
   - Print how to install/run the result in 3 lines or fewer.
   - **Then close the audience step, and do not skip it.** Ask: "Who gets the link?"
     - If the user names a person: if the work is a static app under `apps/`, run `/publish`
       so an actual URL exists, then draft the one-line message with that URL in it. A
       `localhost` address is not a link — nobody can open it.
     - If the user says nobody: record that in one line — "audience: nobody, by choice,
       <date>" — and move on without argument. An acknowledged audience of one is a decision.
       An unacknowledged one is the pattern this repo's `reflections/` directory exists to
       catch: 17 pull requests merged, zero people who have ever opened the result.
3. If the user answers "archive":
   - Tag the branch `archive/<name>-<date>`, push the tag, delete the branch.
   - Confirm in one line what was archived and how to recover it.
4. The user never runs git commands. All git mechanics are yours. Never end the session
   with work in an undecided state.
