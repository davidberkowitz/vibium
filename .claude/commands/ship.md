---
description: End-of-session ship step — merge finished work to main, no git required from the user
---

The user is finishing a work session. Finished work must not be left stranded on a branch —
in this repo's history, a branch not shipped by session's end was never shipped.

Do the following:

1. Show a one-paragraph summary of what this session built and its current branch.
2. Ask exactly one question: **"Ship or archive?"** Offer no third option. If the user
   answers "ship":
   - Merge the current branch into main (fast-forward or merge commit, whichever is
     cleaner) and push main.
   - Delete the merged branch.
   - Print how to install/run the result in 3 lines or fewer.
   - Ask: "Who gets the link?" and draft a one-line message they can send with it.
3. If the user answers "archive":
   - Tag the branch `archive/<name>-<date>`, push the tag, delete the branch.
   - Confirm in one line what was archived and how to recover it.
4. The user never runs git commands. All git mechanics are yours. Never end the session
   with work in an undecided state.
