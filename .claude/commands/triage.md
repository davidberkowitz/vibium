---
description: Audit all branches — every one gets a ship/archive decision, none stay in limbo
---

Audit the state of every branch in this repository so no finished work sits stranded.

1. List all branches (local and remote) with: last commit date, age in days, summary of
   what's on it, lines of unmerged work vs main.
2. For each unmerged branch, present a one-line recommendation: **ship** (merge to main),
   **archive** (tag and delete), or **active** (touched within 14 days).
3. Walk the user through the list one branch at a time, asking only "ship or archive?"
   Execute each answer immediately (merge+push, or tag `archive/<name>-<date>`+delete).
   The user never runs git commands.
4. Finish with the scorecard: branches merged today, branches archived, branches
   remaining, and the oldest undecided branch if any remain.
