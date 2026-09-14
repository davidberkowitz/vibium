#!/bin/sh
# track.sh — regenerate the hard numbers behind reflections/*.md from git alone.
#
# Usage:  sh reflections/track.sh            # markdown report to stdout
#         sh reflections/track.sh > reflections/metrics.md
#         make track                         # same thing, writes metrics.md
#
# Reads nothing but this repository. No network, no external service, no API key.
# Upstream commits (the pre-fork author's) are excluded from every user metric.
set -eu

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

FORK_POINT_EXCLUDE_EMAIL="hugs@vibium.com"   # upstream author — never a user metric
TZ_LOCAL=${TRACK_TZ:-America/Los_Angeles}    # user's local clock (SF)
NOW=$(date -u '+%Y-%m-%d %H:%M UTC')
TMPDAYS=$(mktemp); trap 'rm -f "$TMPDAYS"' EXIT

# Refresh remote refs so "merged" and "stranded" are true, not stale.
# TRACK_OFFLINE=1 skips it; every other number works without the network.
[ "${TRACK_OFFLINE:-0}" = "1" ] || git fetch -q --prune origin 2>/dev/null || true

# The published trunk is what counts as shipped. Prefer the remote's view of it.
if git rev-parse -q --verify refs/remotes/origin/main >/dev/null; then
  MAIN_REF=refs/remotes/origin/main
else
  MAIN_REF=refs/heads/main
fi

# Every non-upstream commit reachable from any ref, oldest first.
# Format: sha \t unix \t author-email \t session-id \t subject
user_commits() {
  git log --all --reverse --date=unix \
    --pretty=format:'%H%x09%at%x09%ae%x09%(trailers:key=Claude-Session,valueonly,separator=)%x09%s' \
  | grep -v "	$FORK_POINT_EXCLUDE_EMAIL	" || true
}

# --- header -----------------------------------------------------------------
cat <<EOF
# metrics.md — generated, do not hand-edit

Generated $NOW by \`reflections/track.sh\`. Local clock: $TZ_LOCAL.
Source: this repository's git history only. Upstream commits (<$FORK_POINT_EXCLUDE_EMAIL>)
are excluded from every number below.

EOF

# --- 1. volume --------------------------------------------------------------
TOTAL=$(user_commits | wc -l | tr -d ' ')
FIRST=$(user_commits | head -1 | cut -f2)
LAST=$(user_commits | tail -1 | cut -f2)
SPAN_DAYS=$(( (LAST - FIRST) / 86400 ))
ACTIVE_DAYS=$(user_commits | while IFS="$(printf '\t')" read -r _ t _ _ _; do
  TZ=$TZ_LOCAL date -d "@$t" '+%Y-%m-%d' 2>/dev/null || date -r "$t" '+%Y-%m-%d'
done | sort -u | wc -l | tr -d ' ')
MERGES=$(git log --all --merges --pretty=format:'%H%x09%ae' \
  | grep -v "	$FORK_POINT_EXCLUDE_EMAIL$" | wc -l | tr -d ' ')
MERGES_MAIN=$(git rev-list --merges --count "$MAIN_REF" 2>/dev/null || echo 0)
WORK=$((TOTAL - MERGES))

cat <<EOF
## 1. Volume

| Metric | Value |
|---|---|
| Commits authored under this fork | $TOTAL ($WORK work, $MERGES merge) |
| Calendar span | $SPAN_DAYS days |
| Days with any commit | $ACTIVE_DAYS |
| Duty cycle (active days / span) | $(awk "BEGIN{printf \"%.1f%%\", 100*$ACTIVE_DAYS/($SPAN_DAYS+1)}") |
| Merge commits on $(basename "$MAIN_REF") | $MERGES_MAIN |

EOF

# --- 2. sessions ------------------------------------------------------------
echo "## 2. Sessions (grouped by Claude-Session trailer)"
echo
echo "| Session | Commits | First (local) | Last (local) | Wall span | Lines +/- |"
echo "|---|---|---|---|---|---|"
user_commits | awk -F'\t' '$4!=""{print $4"\t"$2"\t"$1}' | sort -k1,1 -k2,2n \
| awk -F'\t' '{s[$1]=s[$1]" "$3; n[$1]++; if(!(f[$1]))f[$1]=$2; l[$1]=$2}
   END{for(k in n) print k"\t"n[k]"\t"f[k]"\t"l[k]"\t"s[k]}' \
| sort -t"$(printf '\t')" -k3,3n \
| while IFS="$(printf '\t')" read -r sid n first last shas; do
    fmt() { TZ=$TZ_LOCAL date -d "@$1" '+%b %d %H:%M' 2>/dev/null || date -r "$1" '+%b %d %H:%M'; }
    hours=$(awk "BEGIN{printf \"%.1fh\", ($last-$first)/3600}")
    ins=0; del=0
    for sha in $shas; do
      set -- $(git show --numstat --format= "$sha" | awk '{i+=$1; d+=$2} END{print i+0, d+0}')
      ins=$((ins + $1)); del=$((del + $2))
    done
    short=$(printf '%s' "$sid" | sed 's#.*/##' | cut -c1-18)
    printf '| %s | %s | %s | %s | %s | +%s / -%s |\n' "$short" "$n" "$(fmt "$first")" "$(fmt "$last")" "$hours" "$ins" "$del"
  done
echo

# --- 3. rhythm: gaps between active days -----------------------------------
echo "## 3. Rhythm — gaps between active days"
echo
echo "| Active day (local) | Commits | Days since previous |"
echo "|---|---|---|"
user_commits | while IFS="$(printf '\t')" read -r _ t _ _ _; do
  TZ=$TZ_LOCAL date -d "@$t" '+%Y-%m-%d' 2>/dev/null || date -r "$t" '+%Y-%m-%d'
done | sort | uniq -c | awk '{print $2" "$1}' > "$TMPDAYS"
prev=""
while read -r day n; do
  e=$(date -u -d "$day" +%s 2>/dev/null || date -j -f '%Y-%m-%d' "$day" +%s)
  if [ -n "$prev" ]; then gap=$(( (e - prev) / 86400 )); else gap="—"; fi
  printf '| %s | %s | %s |\n' "$day" "$n" "$gap"
  prev=$e
done < "$TMPDAYS"
echo

# --- 4. clock: hour of day, local ------------------------------------------
echo "## 4. Clock — commit hour, $TZ_LOCAL"
echo
echo '```'
user_commits | while IFS="$(printf '\t')" read -r _ t _ _ _; do
  TZ=$TZ_LOCAL date -d "@$t" '+%H' 2>/dev/null || date -r "$t" '+%H'
done | sort | uniq -c | awk '{bar=""; for(i=0;i<$1;i++) bar=bar"#"; printf "%s:00  %-3s %s\n", $2, $1, bar}'
echo '```'
echo
echo "Weekday split:"
echo
echo '```'
user_commits | while IFS="$(printf '\t')" read -r _ t _ _ _; do
  TZ=$TZ_LOCAL date -d "@$t" '+%a' 2>/dev/null || date -r "$t" '+%a'
done | sort | uniq -c | awk '{bar=""; for(i=0;i<$1;i++) bar=bar"#"; printf "%-4s %-3s %s\n", $2, $1, bar}'
echo '```'
echo

# --- 5. shipping latency ----------------------------------------------------
echo "## 5. Shipping — time from work committed to work merged on main"
echo
echo "| Merged work | Committed (local) | Merged (local) | Latency |"
echo "|---|---|---|---|"
git log --merges --date=unix --pretty=format:'%H%x09%at%x09%s' "$MAIN_REF" 2>/dev/null \
| tac | while IFS="$(printf '\t')" read -r sha mt subj; do
    src=$(git rev-parse "$sha^2" 2>/dev/null) || continue
    st=$(git show -s --format=%at "$src")
    fmt() { TZ=$TZ_LOCAL date -d "@$1" '+%b %d %H:%M' 2>/dev/null || date -r "$1" '+%b %d %H:%M'; }
    lat=$(awk "BEGIN{h=($mt-$st)/3600; if(h<48) printf \"%.1f h\", h; else printf \"%.0f d\", h/24}")
    printf '| %s | %s | %s | %s |\n' "$(printf '%s' "$subj" | cut -c1-52)" "$(fmt "$st")" "$(fmt "$mt")" "$lat"
  done
echo

# --- 6. where the effort goes ----------------------------------------------
echo "## 6. Where the effort goes (lines added, user commits only, by top-level path)"
echo
echo '```'
user_commits | cut -f1 | while read -r sha; do git show --numstat --format= "$sha"; done \
| awk 'NF==3 { split($3,p,"/"); key = (p[2]=="" ? p[1] : p[1]"/"p[2]); ins[key]+=$1 }
   END { for (k in ins) printf "%8d  %s\n", ins[k], k }' | sort -rn | head -15
echo '```'
echo

# --- 7. stranded work -------------------------------------------------------
echo "## 7. Stranded work — remote branches not merged into main"
echo
UNMERGED=0
for line in $(git ls-remote --heads origin 2>/dev/null | awk '{print $2"="$1}' || git for-each-ref --format='%(refname)=%(objectname)' refs/remotes/origin); do
  name=$(printf '%s' "$line" | sed 's/=.*//; s#refs/heads/##; s#refs/remotes/origin/##')
  sha=$(printf '%s' "$line" | sed 's/.*=//')
  [ "$name" = "main" ] && continue
  [ "$name" = "HEAD" ] && continue
  if ! git cat-file -e "$sha" 2>/dev/null; then
    printf -- '- `%s` — not fetched locally, state unknown\n' "$name"; continue
  fi
  if git merge-base --is-ancestor "$sha" "$MAIN_REF" 2>/dev/null; then
    state="merged (branch is dead weight, safe to delete)"
  elif [ -z "$(git cherry "$MAIN_REF" "$sha" 2>/dev/null | grep -c '^+' | grep -v '^0$')" ]; then
    state="squash-merged: content is on main, branch tip is not (safe to delete)"
  else
    state="**no merge commit on main** — verify whether a squash merge landed it"; UNMERGED=$((UNMERGED+1))
  fi
  age=$(( ( $(date -u +%s) - $(git show -s --format=%at "$sha") ) / 86400 ))
  printf -- '- `%s` — %s, tip %s days old\n' "$name" "$state" "$age"
done
echo
echo "Branches with no merge commit on main: **$UNMERGED**"
echo
echo "Caveat: a squash-merged pull request leaves its branch un-ancestored even though the"
echo "content shipped. Check the pull request state before believing this line."
echo

# --- 8. tests ---------------------------------------------------------------
TESTFILES=$(find tests -name '*.test.js' 2>/dev/null | wc -l | tr -d ' ')
TESTCASES=$(grep -rho "^\s*test(" tests 2>/dev/null | wc -l | tr -d ' ')
MAKETARGETS=$(grep -cE '^[a-zA-Z0-9_.-]+:' Makefile 2>/dev/null || echo 0)
cat <<EOF
## 8. Instrumentation present in the tree

| Metric | Value |
|---|---|
| Test files | $TESTFILES |
| Test cases | $TESTCASES |
| Makefile targets | $MAKETARGETS |
| Apps in apps/ | $(ls -1 apps 2>/dev/null | wc -l | tr -d ' ') |
| LEARNING.md debriefs | $(find . -name 'LEARNING.md' -not -path './.git/*' | wc -l | tr -d ' ') |
| Words of debrief written | $(cat $(find . -name 'LEARNING.md' -not -path './.git/*') 2>/dev/null | wc -w | tr -d ' ') |

## 9. Fields git cannot see — fill by hand, date every answer

These are the numbers the gate actually turns on. No commit can prove them.

| Metric | Value | As of |
|---|---|---|
| People other than the author who have opened anything built here |  |  |
| People who have run anything built here |  |  |
| Times the author used a finished artifact after finishing it |  |  |
| Sessions ended with an explicit ship-or-archive decision |  |  |
EOF
