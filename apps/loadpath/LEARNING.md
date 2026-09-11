# Learning: how the Driver Load Path plan got made

Sitting-across-the-table version. What I did, what I threw away, and where the bodies are buried.

---

## Step 1 — The approach, and why

The starting point was a decision about **what kind of object you were asking for**.

"Plan to create a visual simulation" can mean two very different things. It can mean *go build
me a thing and show your reasoning*, or it can mean *give me a plan I can approve or kill before
anyone spends a day on it*. You said "ask me clarifying questions as needed," which settles it.
Nobody asks clarifying questions about work that's already done. You wanted a plan you could
steer.

So the deliverable is a spec, and the first move was not to write anything — it was to find the
**forks in the road where guessing wrong would waste the most work**. There were four:

1. **Fidelity.** Illustrative arrows and real newtons are different projects. One is an
   afternoon, one is a week, and they share almost no code.
2. **Rendering.** 2D and 3D have completely different failure modes.
3. **Scenarios.** Crash loading is a different universe from ride comfort — different sources,
   different math, different liability.
4. **Interaction.** Sliders versus a canned animation changes whether the physics has to run
   in real time or can be precomputed.

Each of those four questions, answered wrong, costs more than the question costs to ask. That's
the test I use for whether to interrupt someone: **would the wrong guess cost more than the
interruption?** Four times yes, so four questions, asked all at once rather than dribbled out.

Then, before writing the plan, I did something that felt like a detour and wasn't: I went and
**checked the physics facts I was about to assert**. More on why in step 6, because that's where
it paid off.

---

## Step 2 — Roads not taken

This is where the real learning is, so here are the ones I actively rejected.

**Rejected: build a prototype first, plan second.** Tempting. I could have had something moving
on screen fast. The reason I didn't is that this project's hard part is invisible from the
outside. You can get a beautiful arrow-covered driver on screen in an hour and have every single
number wrong, and *you would not be able to tell*. A prototype would have generated confidence
without generating correctness. Worse, it would have anchored the architecture around whatever I
happened to hack together. Prototype-first is right when the risk is "will this feel good." It's
wrong when the risk is "is this true."

**Rejected: asking one question at a time.** Conversational, feels natural, and it's a trap. Each
round trip costs you attention, and the four questions weren't dependent on each other — the
answer to "3D or 2D" doesn't change what I need to ask about fidelity. Independent questions go
in one batch. Dependent ones go in sequence. Almost everyone gets this backwards and drips
questions out one at a time because it feels more polite.

**Rejected: including crash and emergency loading.** I offered it as an option and you left it
out, which I think is right, and I'd have pushed back if you'd included it. Crash biomechanics is
a regulated field with published test protocols and real consequences when someone gets a number
wrong. It doesn't belong bolted onto a comfort-and-cornering toy. Scope creep in a simulation is
not "a bit more work" — it's a *different evidentiary standard* for everything you display.

**Rejected: putting the 3D view early.** You asked for both 2D and 3D, and I put 3D dead last
behind an explicit kill gate. The reason is a specific technical constraint: the artifact
sandbox blocks external asset hosts, so there's no rigged human model to download. Any 3D body
has to be built procedurally out of primitives, and procedural humans land in the uncanny valley
almost every time. **A body that looks wrong will make people distrust numbers that are right.**
That's a net loss, so I built in permission to cut it.

**Rejected: a general "vehicle dynamics simulator."** The gravitational pull on a project like
this is to keep generalizing — add suspension geometry, add tire models, add a track editor. I
deliberately pinned it to one narrow claim: *where does force enter your body, and what do you
push back*. A sharp small question beats a fuzzy big one.

**Rejected: hand-drawn SVG for the illustrations.** I hand-drew the technical schematic (the
labeled touchpoint diagram) because that one has to be *exactly* right — every leader line points
at a real anatomical location. But the four atmospheric illustrations went to a generative model,
because there the job is "communicate a feeling of what this is," not "be dimensionally accurate."
**Match the tool's precision to the job's precision requirement.**

---

## Step 3 — How the pieces connect

The plan has an order, and the order is an argument. Here's the spine:

```
Section 01  What it is          →  establishes the ONE claim: force is reciprocal
Section 02  Touchpoint register →  enumerates WHERE, twelve channels
Section 03  Physics core        →  quantifies HOW MUCH, seven equations
Section 04  Indeterminacy       →  admits what the equations DON'T determine
Section 05  Architecture        →  turns 01-04 into files
Section 06  Milestones          →  turns files into an order of operations
Section 07  Failure modes       →  where 01-06 breaks
Section 08  Provenance          →  which numbers are actually trustworthy
Section 09  Illustration prompts
Section 10  References
```

Notice the shape. **It goes claim → detail → math → limits of the math → build → risks →
epistemics.** Every section is legible only because of the one before it. You can't judge the
architecture in 05 without knowing about the indeterminacy problem in 04, and you can't
appreciate 04 without the equations in 03.

The single most important structural choice: **section 04 comes before section 05.** The hardest
technical problem is stated *before* the file layout, because the file layout exists to solve it.
`contacts.js` isn't a file I invented and then justified — it's a file that has to exist because
of a mathematical fact established one section earlier. When a plan's architecture section reads
like a list of plausible-sounding modules, that's usually the tell that nobody found the hard
part yet.

Same logic inside the milestones. M0 has **no user interface at all**. It prints a table to a
console. That's not asceticism, it's sequencing: a wrong number rendered beautifully is more
dangerous than a right number rendered plainly, because the beauty buys it credibility it hasn't
earned.

---

## Step 4 — Tools and methods, and what the alternatives would have cost

**Vehicle model: quasi-static rigid body with a bicycle model for cornering.**
The alternatives were a full multibody dynamics model (correct, and impossible at sixty frames a
second in a browser tab) or pure hand-waving. The bicycle model is the standard first
approximation in vehicle dynamics: treat the car as two wheels on a centerline, ignore tire slip.
It's genuinely accurate well below the traction limit and *honestly wrong* near it — which is a
virtue, because you can then clamp the display at the limit and say so, rather than quietly
extrapolating.

**Force distribution: stiffness-weighted least-norm with unilateral constraints.**
This one deserves a plain-language unpacking, because it's the intellectual core.

Imagine you're holding a heavy table with four other people. Physics tells you the total weight
everyone is holding — that's just the table's mass. Physics does *not* tell you how much each
person is holding. Someone could be slacking. Someone could be taking most of it. The total is
determined; the split isn't. Engineers call this **statically indeterminate**, and it shows up
everywhere from bridge trusses to your own feet.

The standard resolution is to stop treating the contacts as rigid and start treating them as
springs. A stiff spring takes more load, a soft one takes less, and *the split that nature picks
is the one that minimizes stored elastic energy*. That's not a heuristic, it's a real physical
principle (minimum complementary energy). It gives smooth answers as you move a slider, and it
satisfies the force balance exactly by construction rather than by hoping.

Then the crucial twist: **sign constraints**. Seat foam can push you but cannot pull you. Belt
webbing can pull you but cannot push you. Leave those constraints out and your solver will
cheerfully report that the seat back is *pulling you toward it* during braking, which is
nonsense the math is perfectly happy to produce. Adding the constraints turns a simple linear
solve into a small quadratic program — a bit more code, and the difference between a simulation
and a random number generator with good graphics.

The alternative I rejected was hand-tuned percentages per driving regime. Faster to write, and
fatally unfalsifiable: it outputs exactly what you told it to, so it can never surprise you, so
it can never teach you anything. It also jumps discontinuously at regime boundaries, which looks
visibly broken when someone drags a slider.

**Illustrations: Nano Banana Pro, four images, with one regenerated.** Covered in step 6.

**Fact-checking: web search, after the API route was blocked.** Also step 6. It went badly and
that's the useful part.

---

## Step 5 — Tradeoffs, both sides

| I chose | I gave up | Why the trade is right |
|---|---|---|
| Quasi-static model | Transient accuracy — real bodies lag 0.1–0.3s | Runs in real time; lag added later as an explicit, labeled filter |
| Bicycle model | Accuracy near the traction limit | Honest failure mode: clamp and announce, rather than extrapolate |
| 12 contacts | Anatomical resolution (no per-vertebra loads) | 12 is what a driver can actually feel and name |
| Least-norm solver | Simplicity — it's a QP, not a formula | Smooth, exact, and can't produce foam that pulls |
| 2D first | Immediate visual impressiveness | 3D can't render a credible body in this sandbox |
| Cut crash loading | The most dramatic scenario | Different evidentiary standard; would contaminate the whole project |
| Provenance drawer in M2 | Two days of milestone velocity | Retrofitting provenance never happens; it has to be structural |

The one I want to underline is the last. **Building the "where did this number come from" panel
in milestone 2 instead of milestone 7 is the highest-leverage decision in the whole plan.** Not
because it's hard, but because of what it does to everything downstream: once every number on
screen must display its source, you physically cannot add an unsourced number without the gap
being visible. The architecture enforces the discipline so your willpower doesn't have to. That's
the general move — **turn a habit you want into a structure that makes the alternative awkward.**

---

## Step 6 — The mess

Three things went wrong. All three are more useful than the parts that went right.

**Mess one: the fact-check got blocked, and the fallback was worse.**

Your standing preference is to triangulate against other models. I tried to call the OpenAI API
to have a second model check the physics. The sandbox's command classifier blocked the call. Fine
— fall back to web search.

Except web search is a *materially weaker* instrument for this job, and here's the proof. I
searched for the ISO 2631-1 whole-body vibration weighting curves. A university research centre's
summary page came back stating that the vertical z-axis uses the Wd curve and the horizontal x
and y axes use Wk. **That is backwards.** The standard applies Wk to vertical with a multiplying
factor of 1.0, and Wd to horizontal with a factor of 1.4. I only caught it because it contradicted
what I already believed, so I ran a second, differently-worded search that confirmed the correct
assignment along with the multiplying factors.

Sit with that for a second. A reputable secondary source, from a university, stated a standard's
core parameter backwards. If I'd had no prior belief, I'd have taken it. **Search gives you
summaries of summaries; a second model at least gives you an independently-derived answer that
can disagree in an informative way.** The failure mode of search isn't "no answer," it's
"confident wrong answer with an authoritative URL attached."

The correction is written into the plan itself as a visible note, and the constants file is
specified to carry the axis assignment *explicitly with its source* rather than leaving it to
whoever writes the filter. A near-miss that gets designed against is worth more than a clean run.

**Mess two: two primary sources were simply unreachable.**

The environment's egress proxy blocks most domains. Winter's body-segment mass table and the
Waterloo position paper both refused to load. I know the segment fractions from prior knowledge —
head and neck around 8.1% of body mass, trunk 49.7%, thigh 10%, and so on — but I could not
confirm them against the printed table.

The tempting move is to state them cleanly and move on. Nobody would check. Instead they're in
Table 2 marked **"Unverified this session"** with an instruction to check before milestone 0 is
signed off. This is the whole ballgame for a document like this: **the value of the table is not
the numbers, it's the accuracy of the confidence labels on the numbers.** A table where
everything looks equally solid is less useful than one that tells you which three rows to go
check.

**Mess three: the first hero image lied in a very specific way.**

Nano Banana rendered a genuinely good cutaway — transparent car, seated skeleton, red vectors
running from the tire contact patches up through the suspension into the pelvis and spine. And it
covered the thing in annotation labels reading `DRYWRY FORCE ITION` and `STEUNCIG TYPE`. Garbled
non-words in a technical-label typeface, arranged exactly where real labels go.

This is worse than an obviously bad image. At thumbnail size it reads as a professionally
annotated engineering diagram. It's only wrong when you look, which means it's the kind of wrong
that survives review. And it would sit at the top of a document whose entire argument is *we are
careful about what we assert*.

The fix was to stop asking for something the model can't do. The regenerated prompt says: no
text, no lettering, no numbers, no labels, and terminate every leader line **in an empty circle**
instead of a word. That last clause is the trick — it gives the model something specific to draw
in the place where it wanted to hallucinate text. The result is clean, and the failure is
documented in the plan so nobody repeats it.

Worth noting what went *right* here too: the four-panel weight-transfer diagram came back with
correct physics unprompted — braking loads the front tires, throttle loads the rear, cornering
loads the outside pair, with matching dots on the friction ellipses. I checked it against the
equations rather than assuming. **Spot-check generated images by actually looking at them.** The
failures are invisible from the file size.

---

## Step 7 — Pitfalls, the things I wish someone had said earlier

**The friction ellipse will get you.** The single most common error in casual vehicle simulations
is allowing full braking and full cornering at the same time, because each passes its own check
independently. It can't happen — a tire has one friction budget and the two demands share it.
Check the *resultant*, not the axes. Write the test case that asserts the diagonal fails.

**Displayed precision is a promise you're making.** The moment your page reads "412 N through
your left bolster," someone will quote that number in a meeting. The model deserves maybe one
significant figure and a band. Show what you can defend, not what the float contains.

**A statically indeterminate problem will not announce itself.** Nothing errors. Your code runs
fine and produces *a* distribution — whichever one your arbitrary code path happened to pick. You
have to notice, on your own, that the problem has more unknowns than equations. Learn to count:
unknowns versus independent equations. If unknowns win, you have a modeling decision to make, and
if you don't make it deliberately, your code will make it for you.

**Never mix time-domain and frequency-domain quantities in one number.** Load transfer is a
quasi-static balance at an instant. Whole-body vibration is a weighted RMS over an exposure
window. Averaging a comfort index into a force arrow produces something that means nothing.
Different mathematics gets different panels.

**Generated images fail in ways that look like success.** Garbled text, wrong ethnicity, mirrored
padding at the wrong aspect ratio, seams. None of it shows in the file size or the API response.
Open them.

**When your fact-check tool gets downgraded, downgrade your confidence with it.** The
seductive thing about falling back from a strong method to a weak one is that you still get
answers, and answers feel like answers. I got an authoritative-looking wrong answer within
seconds of the fallback. Label the provenance.

---

## Step 8 — What an expert notices that a beginner doesn't

**A beginner asks "what forces act on the driver." An expert asks "what forces does the driver
act with."** Newton's third law is taught to everyone at fifteen and internalized by almost
nobody. Every force diagram of a driver you'll find online shows arrows pointing *at* the body.
The reciprocal arrows — the driver shoving the bolster sideways, the driver's 78 kg riding
off-centerline and shifting the car's own center of gravity — are physically identical in
magnitude and nearly always missing. Noticing the missing half of a diagram is a senior skill.

**A beginner sees "distribute the force across contacts" as an implementation detail. An expert
recognizes it instantly as an indeterminate problem** and knows that it's the hardest thing in
the project. That recognition is what moved it from milestone 6 to milestone 2. Beginners
schedule by what looks hard (the 3D rendering). Experts schedule by **what has the most ways to
be silently wrong.**

**A beginner adds sign constraints when a bug shows up. An expert adds them before writing the
solver,** because they can predict the specific nonsense that results from omitting them — foam
that pulls. Knowing your model's characteristic failure before you run it is most of what
experience buys you.

**A beginner treats "verified" as binary. An expert tracks provenance per value.** Table 2 has
five distinct confidence states: design choice, verified by search, verified and corrected,
unverified this session, placeholder. A beginner would have written one table and implied
uniform authority across it.

**And the small one: an expert writes down that the project doesn't belong where it lives.**
This is a vehicle biomechanics simulation sitting in a repository whose stated purpose is browser
automation for AI agents. It joins two other unrelated projects in the same `apps/` folder. That's
listed in the failure modes section, with a concrete fix: either declare `apps/` a sandbox in
CLAUDE.md, or move all three out. Naming the drift costs one paragraph. Letting it compound costs
you a repository nobody can describe in one sentence.

---

## Step 9 — What transfers to completely different work

**Ask the questions whose wrong answers are expensive; guess the rest.** The filter is a cost
comparison, not a comfort level. Four questions here, batched because they were independent. Most
people either ask nothing and rebuild, or ask everything and stall.

**Find the indeterminate part of any problem.** This generalizes far past physics. A budget where
the total is fixed but the split isn't. A schedule where the deadline is set but the sequencing
isn't. A hiring decision where the headcount is approved but the shape of the team isn't. In every
case the same trap applies: *if you don't resolve it deliberately, some arbitrary process resolves
it for you and you won't notice.* Learn to spot "we know the sum but not the terms."

**Build the discipline into the structure, not into your intentions.** The provenance drawer at
milestone 2 is the model. Don't resolve to cite your sources — build the thing that makes an
uncited number visibly incomplete. This works for writing, for finance, for code review, for
anything you'd otherwise have to remember to do.

**Pre-authorize your own retreats.** The 3D view has an explicit written kill gate. Sunk cost
doesn't grip you when you decided the abandonment criteria before you started spending. Do this
for any part of a project you suspect might not work: write down, in advance, what "not working"
looks like and what you'll do about it.

**Downgraded evidence needs a downgraded claim.** When your best verification method is
unavailable and you fall back to a weaker one, the weaker one still produces confident-sounding
output. The ISO weighting curves came back backwards from a university source. Track *how* you
know something alongside *what* you know.

**A wrong thing rendered beautifully is more dangerous than a wrong thing rendered plainly.**
This is why milestone 0 has no interface. Polish is a credibility multiplier, and it multiplies
regardless of the sign of what it's applied to. Establish correctness in a form ugly enough that
nobody would believe it on aesthetics alone, then make it beautiful.

**Match your tool's precision to the job's precision requirement.** The anatomical schematic was
hand-drawn because every leader line points somewhere real. The atmospheric illustrations were
generated because the requirement there was mood. Using a precise tool for a vague job wastes
time; using a vague tool for a precise job produces `DRYWRY FORCE ITION`.

---

*Prepared by David Berkowitz. Research and drafting with Anthropic Claude. Illustrations from
Google Gemini Nano Banana.*

---
---

# Learning, part two: building M0

The plan is one thing. Writing the code that has to actually be right is another. Here's what
happened when the model core got built, in the same over-coffee register.

## Step 1 — Approach: pick the frame before writing a single equation

The very first thing I wrote wasn't math. It was this comment:

> Frame: ISO 8855. x forward, y to the driver's **left**, z up.

That looks like bookkeeping. It's the highest-leverage line in the whole milestone, because
**every sign error you will ever have lives in the gap between two people's coordinate frames.**
There are two competing standards here: SAE J670 uses x forward, y *right*, z *down*; ISO 8855
uses x forward, y *left*, z *up*. Both are correct. Mix them and a left turn silently becomes a
right turn somewhere in the middle of your codebase, and every arrow you draw afterward is a lie.

I picked ISO because z-up is what a human expects when the subject is a person sitting upright,
and then I wrote the consequence down explicitly: *positive lateral acceleration is a left turn,
so the loaded outer wheels are on the right.* That sentence is what the tests assert against.

Then the equations went in the plan's order — cornering, load transfer, friction ellipse, then
occupant — because each one consumes the previous one's output.

## Step 2 — Roads not taken, this time

**Rejected: `{value: 1600, source: "..."}` for every constant.** My first instinct was to attach
provenance directly to each number, so it's impossible to have one without the other. I wrote a
bit of it and threw it away, because every piece of arithmetic downstream turns into
`params.mass.value * params.cgHeight.value` and the physics becomes unreadable. Unreadable
physics is how sign errors hide.

What I did instead: two parallel exports. `CONSTANTS` holds plain numbers so the math reads like
math. `PROVENANCE` holds one record per number. And then — this is the part that makes it work —
**a test walks every numeric constant and fails if it has no provenance record.** The structure
doesn't enforce the pairing; the test does. Same guarantee, readable code.

That's a general pattern worth stealing: when the clean-looking enforcement mechanism makes the
primary code worse, move the enforcement into a test instead.

**Rejected: the plan's own file layout.** The plan said tests go in `apps/loadpath/tests/`. The
repository already had `tests/gridprobe/` and `tests/mindmap/` at the root, wired into a Makefile
target. I followed the repo, not my own document, and then went back and corrected the document.

Worth being explicit about the priority order: **an existing convention in the codebase beats a
plan I wrote yesterday.** A plan is a prediction. A convention is a fact. When they disagree, the
plan was wrong, and the fix is to update the plan — not to quietly leave two contradicting
descriptions of the same project lying around.

**Rejected: a placeholder contact-force split.** It would have been easy, and mildly satisfying,
to stub in "60% seat pan, 25% bolster, 15% belt" so the milestone produced richer output. I
didn't, because the plan explicitly puts that in M2 and because a plausible-looking placeholder
is exactly the kind of number that survives into production by accident. Instead the report ends
with a line saying, in plain words, that the split isn't modelled yet and why.

## Step 3 — The test that made all the others meaningful

Here's the one I want you to actually remember.

There are 57 tests. 20 of them are the Newton's third law audit, run across ten driving
scenarios. They all pass. Great — except a test that always passes proves nothing at all, and I
had no evidence that this audit could ever *detect* anything.

So I wrote this:

```js
test('the audit is capable of failing', () => {
  const s = O.solve({ bodyMass: DRIVER, accel: O.vec(-6, 4, 0) });
  s.segments[0].carOnBody.x += 50;          // inject a 50 N error
  s.carOnBody = s.segments.reduce(...);      // recompute the total
  assert.ok(O.auditThirdLaw(s).sumResidual > 49, 'the audit missed a 50 N error');
});
```

Deliberately break the state, then assert that the check screams. This is called a **negative
control**, and it's standard in lab science and weirdly rare in software. The reasoning is simple:
if your smoke alarm has never once gone off, you don't know whether you live in a safe house or
own a broken alarm.

Any time you write a validator, an assertion, a lint rule, a monitoring check — write the test
that proves it fires. It takes four lines and it converts "all green" from a hope into a fact.

## Step 4 — The bug the milestone found in the plan

This is the good part.

The constants file has three occupant presets: 50th percentile male, 95th percentile male, and
5th percentile female. Perfectly reasonable. And the segment mass fractions come from Dempster's
1955 study, which I'd confirmed by search.

While writing the provenance record I actually read what the search had told me about the source.
Dempster's sample was **nine male white cadavers.**

Sit with the implication for a second. The fractions say a trunk is 49.7% of body mass, a thigh
10%, and so on. Selecting the "5th percentile female" preset changes the total mass from 78 kg to
49 kg — and then multiplies it by *exactly the same proportions*. **The female preset is a scaled
male.** Body composition genuinely differs between sexes in ways that change these fractions, so
the preset is presenting a difference it does not actually model.

Nobody would have caught this from the output. The numbers are internally consistent, they sum to
1.000, every test passes. It's only visible if you read the provenance of the data instead of just
the data.

Three things came out of it. The caveat now lives in `constants.js` next to the numbers. It prints
at the bottom of every report run under the heading "numbers you should not quote yet." And it's a
new entry in the plan's failure-modes section with a concrete fix: either find sex-specific
fractions, or relabel the control as a plain mass slider and stop implying it models a different
body.

The general lesson: **"where did this data come from" is a different question from "is this data
correct," and only the first one catches this class of error.** The number was right. The *use* of
it was wrong.

## Step 5 — Tradeoffs made in the code

| Chose | Gave up | Why |
|---|---|---|
| IIFE modules on the global | Modern ES modules, tree shaking | Matches gridprobe exactly; works in `require()` and in a `<script>` tag with no build step |
| `ay = δv²/(L + Kv²)` | The textbook `δ = L/R + K·a_y` form | Algebraically identical, but returns exactly 0 at a standstill instead of dividing by zero |
| Report shows *demanded* friction % but *clamped* acceleration | One consistent number | You want to see both: what the driver asked for, and what the tyres actually delivered. The status column names the gap |
| Lateral transfer split by static weight | Split by roll stiffness (correct) | Roll stiffness needs spring and anti-roll-bar rates we don't have. Marked `placeholder`, prints as a caveat |
| Plain console table | Even a minimal HTML view | The whole point of M0 |

## Step 6 — Mess

**The 14 that I called 12.** I wrote a test named "segment masses expand to twelve physical parts"
and asserted `segs.length === 14`. Both the assertion and the code were right; the *name* was
wrong. Eight segment types, six of which come in pairs: 2 + 12 = 14. I'd mentally anchored on the
twelve touchpoints from the plan and let the number bleed across into an unrelated count.

It passed. Tests don't check their own names. If someone reads that test in six months looking for
the segment count, the comment lies to them and the code doesn't. Caught it on re-read and fixed
it — but note the failure mode: **a passing test can still contain a false statement**, and that
statement is documentation.

**Sign conventions ate the most time.** Deriving the lateral load transfer, I first wrote
`outer = axle/2 + ΔF/2`, halving the transfer. Wrong. Taking moments about the outer contact
patch gives `inner = W/2 − ΔF` and `outer = W/2 + ΔF` — the full ΔF is added to one side and
subtracted from the other. The half-factor felt intuitively right because "it's split between two
wheels," and intuition is exactly the wrong instrument here.

What saved it was a test I'd written for a different reason: *load transfer redistributes weight,
it never creates or destroys it.* Sum all four corners across six different acceleration states
and you must get the vehicle's weight back, to 1e-8. The halved version passed that too, actually
— so what really caught it was working the moment balance on paper. But the conservation test is
still the one I'd keep, because it catches the larger family of errors.

**Egress blocked the primary sources again.** I still could not reach Winter's table or the
Waterloo paper. What I could do was an *internal* check that needs no source at all: the fractions
sum to exactly 1.000. That's a real constraint — a body is one body — and it's now an assertion.
It doesn't prove the values are Dempster's, but it proves they're mutually consistent, which rules
out a whole class of transcription error.

**Verification you can do locally beats verification you can't do at all.** When the source is out
of reach, look for an invariant the data must satisfy on its own terms.

## Step 7 — Pitfalls for next time

- **Write the frame convention down before the first equation.** Then write the *consequence*
  ("positive ay is a left turn, outer wheels are on the right") as prose, and test against the
  prose.
- **Never halve a load transfer.** Derive it from a moment balance once and write the derivation
  in the comment so nobody re-guesses it.
- **Conservation tests are cheap and catch things you didn't predict.** Sum-of-corners equals
  weight. Sum-of-segments equals body. These take two minutes and cover errors you'd never think
  to enumerate.
- **Read your data's provenance, not just its values.** The Dempster sample problem was invisible
  from every number in the system.
- **Test names are documentation and nothing checks them.** Re-read them as prose.
- **Handle bad CLI input on the first pass.** `--surface ice` prints the three valid options and
  exits 1. Thirty seconds of work, and it's the difference between a tool and a script.

## Step 8 — What an expert notices here

**An expert reads the friction column and the acceleration column together and immediately asks
which one is the demand and which is the delivery.** In the panic stop row, friction says 102% and
the acceleration says exactly 0.90 g. Those look contradictory until you realise one is what the
driver asked for and the other is what the road gave. A beginner reconciles them into one number
and loses the most interesting fact on the row.

**An expert is suspicious of a test suite with no negative controls.** Fifty-seven green tests is
not evidence until at least one of them has been shown capable of turning red.

**An expert treats "it sums correctly" as necessary, not sufficient.** The segment fractions sum
to 1.000 and are still drawn from a sample that makes one of the presets misleading.

**An expert writes the limitation into the output, not just the docs.** Anyone can put a caveat in
a README nobody opens. Printing "numbers you should not quote yet" at the bottom of every single
run means the caveat is in front of the person at the moment they're about to quote something.

## Step 9 — What transfers

**Negative controls generalise everywhere.** Any check you rely on — a test, an alert, a
reconciliation, a fraud rule, a code review checklist — should be deliberately tripped once so you
know it works. "We've never had an incident" and "our detection is broken" produce identical
dashboards.

**Provenance is a separate axis from correctness.** A number can be accurate and still be the
wrong number for the job, and only the question *where did this come from, and on what sample*
distinguishes them. This applies to a market-size figure in a deck, a benchmark in a vendor
comparison, and a body-segment table alike.

**When two of your own documents disagree, one of them is now actively harmful.** The plan said
tests go in one place; the repo said another. Leaving both is worse than either, because the next
person has to guess. Pick, then go back and fix the loser.

**Look for the invariant when you can't reach the source.** Things that must be true internally —
a body is one body, weight is conserved, a proportion sums to one — give you real verification
when external checking is unavailable.

**Make the caveat travel with the number.** Not in a footnote, not in the appendix. In the same
struct, printed in the same output, so it can't get separated from the thing it qualifies.

*Prepared by David Berkowitz. Research and drafting with Anthropic Claude. Illustrations from
Google Gemini Nano Banana.*

---
---

# Learning, part three: building M1

The first milestone with pixels in it. Which meant the first milestone where being wrong was
visible — and, it turns out, where being wrong was *invisible* in a new and more interesting way.

## Step 1 — Approach: draw the skeleton before drawing anything

The instinct with a figure like this is to start placing shapes until it looks like a person. I
did that in the plan document weeks ago and got away with it, because that drawing was
decoration. This one is not: twelve labelled markers have to land on twelve specific pieces of
anatomy, and every marker's position is measured against the body.

So the first thing in the file is not a shape, it's a table of joint coordinates:

```js
var JOINT = {
  hip:      { x: 275, y: 285 },   // H-point
  shoulder: { x: 232, y: 192 },
  knee:     { x: 390, y: 268 },
  ...
};
```

Everything else derives from that. The torso is a line from hip to shoulder. The seat back is a
bar offset behind that same line. The "02 Seat back" marker sits on the seat back's outer face,
computed from the same axis.

**One source of truth for geometry, same as one source of truth for data.** When I later decided
the pose was too reclined, I moved two numbers and the whole figure — seat, body, markers —
followed. Had I hand-placed forty shapes, that fix would have been an afternoon.

The car-industry term for the hip joint is the **H-point**, and it's the datum the entire seating
package is measured from in real vehicle design. Using the real datum wasn't decoration; it's
what made the geometry composable.

## Step 2 — Roads not taken

**Rejected: showing a force number at each contact.** This was the big one, and it was tempting
because it would have made the screen look *finished*. Twelve contacts, twelve numbers, done.

I didn't, because the split of the total force across those twelve contacts is the statically
indeterminate problem from M0 — and it is milestone 2's entire job. Any number I put next to
"seat pan" today would be a guess wearing a lab coat.

So the panel says, in plain words: *where that total divides across the twelve contacts is not
modelled yet.* An admission on screen beats a fabrication on screen. It also creates useful
pressure: the gap is visible every time anyone opens the page, which is a much better motivator
for building M2 properly than a note in a backlog.

**Rejected: deleting the headless report.** My own plan said `m0-report.js` would be deleted once
the browser app existed. When I got there, I kept it — and went back and corrected the plan,
with a note explaining the reversal.

The report is the only thing that prints the unsourced constants on every run, it needs no
browser, and it's the fastest way to check the physics didn't break. Deleting a working
verification tool because a document predicted its removal is precisely the plan-over-reality
mistake this project keeps catching itself making. **A plan is a prediction. When reality
disagrees, update the prediction — don't damage reality to match it.**

**Rejected: an anatomically detailed body.** The figure is capsules and circles on purpose. A
realistic body invites the viewer to read detail the model does not have — muscle, posture,
tissue compliance, none of which is simulated. The schematic look is a promise about fidelity,
kept visually.

**Rejected: drawing the bolster force as an arrow.** The side bolster acts along the axis
pointing *into the page*. In a side elevation there is no honest direction to draw. So it gets
⊗, the drafting convention for exactly that, and the legend explains it. Drawing a plausible
sideways arrow would have been the visual equivalent of a made-up number.

**Rejected: solid belt lines.** Belts are drawn dashed and faded because at rest they are slack
and carrying zero. A crisp solid belt would visually claim a load the model says doesn't exist.

## Step 3 — How the pieces connect

```
model/touchpoints.js   WHAT each contact is: anatomy, axis, sign constraint
      ↓                (no coordinates — it knows nothing about pictures)
view2d/side.js         WHERE it is in this view, keyed by the same ids
      ↓                (no physics — it knows nothing about newtons)
view2d/vectors.js      HOW an arrow is drawn and scaled
      ↓
app.js                 wires model → view, handles selection
```

The split that earns its keep is the first one. `touchpoints.js` has no x/y coordinates in it at
all. That's what lets M3's overhead plan view reuse all twelve contacts with completely different
positions, without a single fact about anatomy being duplicated or drifting between the two
views. The id is the joint.

The same discipline as M0's `CONSTANTS` / `PROVENANCE` split, applied to a different axis: **keep
the thing separate from where the thing is drawn.**

## Step 4 — Tools, and one small trick

**Plain SVG built through the DOM, no library.** The figure has maybe sixty elements and needs
hover, focus, click and keyboard handling on twelve of them. That's what the DOM already does.
D3 or a framework would have added a build step to a project whose whole architecture is "open
index.html and it works."

**The outlined-bar trick.** Every piece of seat furniture — back, pan, pedestal, head restraint,
armrest — needs to look like a solid object with an outline, at an arbitrary angle. Computing
four rotated rectangle corners for each is fiddly and error-prone. Instead:

```js
// thick line in the outline colour, thinner line in the fill colour on top
el('line', {..., stroke: 'var(--line-strong)', 'stroke-width': width});
el('line', {..., stroke: 'var(--bg-soft)',     'stroke-width': width - 4.4});
```

Two lines, any angle, rounded ends for free. When the seat read too faintly in the first render,
the fix was changing `2.6` to `4.4` — one number, thicker outline everywhere.

**Chromium headless for proof.** Playwright isn't installed here but the browser binary is, so
`--screenshot` with `--virtual-time-budget` was enough. Which brings us to the thing I want you to
take from this milestone.

## Step 5 — Tradeoffs

| Chose | Gave up | Why |
|---|---|---|
| Schematic body | Visual impressiveness | The drawing shouldn't promise fidelity the model lacks |
| No per-contact numbers | A "finished" looking screen | Every one would be fabricated until M2 |
| Ids in model, coordinates in view | One tidy file | M3's plan view reuses all twelve for free |
| Deep-link `?select=` | Strict milestone minimalism | It made the interaction screenshot-testable, which is worth more |
| Dashed slack belts | A cleaner drawing | Solid webbing would claim a load of zero as if it were real |

## Step 6 — The mess, and the lesson of this milestone

**The first render passed every test and was visibly wrong.**

Sixty-nine tests green. The page loaded. The panel numbers were exact. And when I actually looked
at the screenshot, the driver appeared to be *lying down*, and several contact markers pointed at
empty space — "02 Seat back" had a dot floating beside the seat, "01 Seat pan" pointed at a pan
hidden entirely behind the thigh.

Nothing could have caught this except looking. There is no unit test for "does this read as a
person sitting in a car." The tests verified that twelve contacts exist, that belts are
tension-only, that nothing tension-only is loaded at rest — all true, all useless against this
failure.

So I fixed the pose (real driving package: knees slightly above hips, torso reclined about 25
degrees), moved every marker onto a feature that is actually visible, widened the seat pan so a
strip shows below the thigh, and thickened the furniture outlines. Then looked again. Then found
two force labels colliding, moved the reaction arrow into a clear lane, and looked a third time.

**Three rounds of look-and-fix, none of which any test would have prompted.**

This is the same shape as the garbled `DRYWRY FORCE ITION` labels in the illustration back at the
planning stage: *a failure that is invisible from every signal except a human looking at the
output.* Two milestones, two instances. That's a pattern, not a coincidence.

## Step 7 — Pitfalls

- **Green tests are not a rendered page.** If the deliverable is visual, budget for looking at it,
  and budget for looking at it *more than once*. The second look finds what the first fix broke.
- **A marker pointing at empty space is worse than no marker.** It teaches the viewer something
  false about where force enters the body.
- **Place labels against the skeleton, not against the last version of the drawing.** When the
  pose changed, markers pinned to old pixel positions became lies.
- **Draw absent things as absent.** Slack belts dashed, gated contacts marked idle. Visual weight
  is a claim about load.
- **When a view can't honestly show a direction, use the convention that says so.** ⊗ exists for
  exactly this.
- **Check the label collisions at the size people will actually view it**, not at the size you
  authored it.

## Step 8 — What an expert notices

**An expert checks whether the picture and the numbers can disagree.** Here they can't, because
the panel reads from the same `occupant.solve()` the figure does. A beginner would have typed
"765 N" into the caption as text, and it would have silently gone stale the first time anyone
changed the driver mass.

**An expert reads the dashes.** Dashed slack webbing, "IDLE" pills, greyed contact numbers — the
drawing encodes *what is not carrying load* as carefully as what is. Most diagrams draw every
component at equal weight and lose that information entirely.

**An expert asks what the figure is promising.** A photorealistic body promises tissue mechanics.
Capsules promise a rigid-body approximation. The drawing style is itself a claim about fidelity,
and an honest one is worth more than an impressive one.

**An expert notices what's missing and whether its absence is stated.** The per-contact split
isn't there — and the page says so, in the caption, in the panel note, in the plan. Silence about
a gap is how a gap becomes a bug someone else discovers.

## Step 9 — What transfers

**Automated checks and human review catch disjoint sets of errors.** Not overlapping sets —
*disjoint*. Tests caught nothing about the pose; looking caught nothing about the sign
constraints. A process with only one of them has a hole shaped exactly like the other. This is
true of financial models, legal documents, and slide decks as much as code.

**Look at the output more than once.** The first pass finds the loudest problem. The second finds
what your fix disturbed. I have never once been done after the first look.

**Separate the entity from its presentation, and connect them by a stable id.** Touchpoint data
knows no coordinates; the view knows no physics. This is why a second view costs almost nothing
later. The same move works for a customer record and its display, a metric and its chart.

**Absence deserves as much design as presence.** The dashed slack belt, the greyed idle row, the
sentence saying a number isn't modelled yet. Most people design only the filled-in state and let
the empty state fall out by accident, which is how "no data" ends up rendering as zero.

**When your plan and reality disagree, fix the plan.** I kept a tool my own document said to
delete, and edited the document. The alternative — deleting something useful to satisfy a
prediction — is a surprisingly common and entirely avoidable way to make work worse.

*Prepared by David Berkowitz. Research and drafting with Anthropic Claude. Illustrations from
Google Gemini Nano Banana.*

## Postscript: running it found a third one

After M1 was pushed, I drove the app for real — actual mouse clicks and key events over
the DevTools protocol, not just a screenshot. Every interaction worked: click a contact in the
figure, the panel follows; click a row in the panel, the figure follows; focus and press Enter,
same result. No JavaScript errors.

Then I set the viewport to 420px wide, and the figure had **collapsed to a 30-pixel sliver.**

The cause was ordinary: below 900px the layout switched the flex row to a flex column, and the
panel's very tall content claimed the entire column height, leaving the figure nothing. Two
elements both saying "give me the remaining space," and the taller one won.

The fix was to stop refereeing it — below 900px the page drops out of flex entirely and becomes
an ordinary scrolling document, figure first, panel underneath.

**That's the third defect on this project that only a human looking could catch**, after the
garbled illustration labels and the reclining driver. Every one of them passed every automated
check. And note what made this one visible: not *a* look, but a look at a **different viewport**.
The desktop screenshots were fine. The bug lived in a state I hadn't rendered yet.

One more wrinkle worth remembering: the first fix appeared to do nothing, because the browser had
cached the stylesheet. I nearly went looking for a CSS bug that didn't exist. If a change to
static assets seems to have no effect, **suspect the cache before you suspect your code** — turn
it off, then re-test.

So the rule from step 9 gets sharper. It isn't "look at the output." It's **look at the output in
every state a user can put it in**: each viewport, each selection, empty and full. A single
screenshot of a single state is one sample from a space, and bugs live in the parts you didn't
sample.

---
---

# Learning, part four: building M2, the indeterminate split

This is the one the whole project was pointed at. Two milestones of saying "we don't model that
yet" finally came due.

## Step 1 — Approach: solve the dual, not the problem

The problem: the total force on the driver is known, but there are fourteen ways it could reach
them and only three equations of force balance. Infinitely many valid answers. Pick one, on
principle.

The principle was decided back in the plan — minimum stored elastic energy, subject to each
contact only pushing or pulling the way it physically can. That makes it a **quadratic program**:
minimise a sum of squares, subject to equalities and inequalities.

The obvious move is to reach for a QP library. I didn't, and the reason is the most satisfying
thing in this milestone.

Substituting `lambda = sqrt(k) * z` turns the objective into a plain minimum-norm problem. Write
down its optimality conditions — the Karush-Kuhn-Tucker conditions, the standard characterisation
of a constrained optimum — and they collapse to something startling:

```
z = clamp(A' y, 0, cap)     for some y in R^3
```

Every one of the fourteen unknowns is a **function of just three numbers.** Substituting that back
into the force balance leaves an unconstrained convex minimisation in three variables, which
Newton's method eats in tens of iterations.

Think of it like this. You have fourteen dials to set and three readings to hit. Rather than
searching fourteen-dimensional space, the maths says: all the settings that could possibly be
optimal lie on a three-dimensional surface, parameterised by `y`. So stop searching the room and
search the surface.

**The payoff isn't speed, it's guarantees.** Because `z` is a clamp, no force can come back
negative and none can exceed its cap — not because anything checks afterwards, but because the
expression cannot produce such a value. A whole category of bug is structurally impossible rather
than tested against.

## Step 2 — Roads not taken

**Rejected: a QP library.** Would have worked. It would also have been a dependency in a project
whose architecture is "open index.html and it works," and it would have hidden the one genuinely
interesting piece of reasoning inside a black box. The dual reduction is fifty lines and you can
read why it's correct.

**Rejected: hand-tuned percentages per driving regime.** The placeholder the plan warned about.
Fast, and unfalsifiable in the bad sense: it outputs exactly what you told it to, so it can never
surprise you, so it can never be wrong in a way you'd notice. It also jumps at regime boundaries.
There's a test in this milestone that specifically checks the split moves *smoothly* as the input
does, because that's the visible difference between a solved answer and a lookup table.

**Rejected: modelling belt slack by displacement.** Correct, and it needs a dynamic model this
one doesn't have. Instead the belts engage structurally: they come in only when the gap-free
contacts cannot supply the required force on their own. That gets both ends right — nothing in
the webbing going straight, belt engaged in a hard stop — and the caveat says plainly that the
transition is a step where reality is gradual.

**Rejected: shipping the provenance drawer in a later milestone.** It ships in the *same* one as
the solver, because this is the exact moment the page starts putting authoritative newtons next
to body parts.

## Step 3 — The bug that only physics could catch

First working version. All the maths right, balance closing to machine precision, no negative
forces. And it reported that under **0.8 g braking, the seat belts carry exactly zero.**

Every automated check passed. The force balance closed. No sign constraint was violated. And the
result was nonsense — or rather, it was the correct answer to a question I'd asked wrong.

What was missing: nothing limited how hard the driver could brace. The solver noticed it could
push on the steering rim and the dead pedal, found that cheaper than loading the belt, and braced
its way out of any deceleration you gave it. With unlimited arms, you never need a seatbelt.

The fix was to add an upper bound to each voluntary channel. Mathematically small — `max(0, t)`
becomes `clamp(t, 0, cap)`, and the Hessian excludes channels pinned at either limit. Physically
it changes everything: bracing has a ceiling, and past it the load has to go somewhere else.

Then a second calibration question, subtler. What *is* the ceiling? Maximum human capacity, or
typical effort? If you use maximum — a genuine maximal leg press against the footrest — the belts
still never engage, because a person really can brace against 1.2 g if that's all they're doing.
But a driver in a panic stop isn't performing a maximal leg press. **They're busy braking and
steering.** So the caps are typical voluntary effort, and they're flagged as the placeholder that
moves the model's single most visible result.

With that, the behaviour came right: gentle stop absorbed by bracing, hard stop saturates the
bracing and the shoulder belt becomes the largest single contact on the body. Which is what a
seatbelt is *for*.

**The lesson: a model can be mathematically flawless and physically incomplete, and only domain
reasoning tells the difference.** No test I could have written from inside the code would have
flagged "this driver has unlimited arms."

## Step 4 — An emergent result I didn't build

Once the belts engaged, the output showed something I hadn't put there: in a **straight-line**
hard stop, the side bolster picks up load. Lateral force, in a car going perfectly straight.

That's correct. A shoulder belt runs diagonally across your body, so when it pulls you back it
also pulls you sideways, and something has to resist that. The bolster does.

I didn't code that. It fell out of representing forces as actual 3-D vectors with actual
directions rather than as scalars in labelled buckets. There's now a test asserting it, because a
result you can derive but didn't intend is the best evidence your representation is real and not
a pile of special cases.

## Step 5 — Tradeoffs

| Chose | Gave up | Why |
|---|---|---|
| Dual reduction, hand-rolled | A library's robustness | Fifty readable lines, no dependency, guarantees by construction |
| Caps as typical effort | Defensible maximum-capacity numbers | Maximum effort predicts belts that never engage, which is wrong |
| Tuned stiffnesses | Measured ones | A point-mass occupant discards limb geometry; the ratios absorb it |
| Structural slack rule | Displacement-based engagement | Needs a dynamic model; both endpoints come out right |
| Stall detection | Chasing the last 1e-6 N | Six orders below the model's own uncertainty |
| Solver + drawer in one milestone | A faster-looking M2 | Provenance retrofitted is provenance never built |

## Step 6 — The mess

**Iteration zero did nothing.** The first run reported every case infeasible after zero
iterations. The cause: starting Newton at the origin, where no channel is active, so the
generalised Hessian is *empty* — zero information about which way to step. The line search then
failed on its first attempt and the loop broke immediately.

Fixed by warm-starting from the unconstrained least-norm solution, `y = (AA')^-1 b`, which
activates a sensible set straight away and is the exact answer whenever no constraint binds.
**A Newton method needs somewhere to start where its derivative means something.**

**The line search rejected everything when the objective was zero.** My acceptance test was
"phi must decrease by a relative amount," which at phi = 0 demands a strictly negative value.
Replaced with the standard Armijo condition, which measures against the directional derivative
rather than the value.

**It stalled at 200 iterations for no gain.** At certain accelerations two channels sit exactly at
their caps, the Hessian loses rank in that direction, and the active set chatters — flipping a
channel between free and saturated, making no progress. Added stall detection, and dropped the
worst case from 200 iterations to 32.

Then the honest part: my module comment claimed the balance closed "to machine precision." After
the stall fix, the worst residual across 1881 swept cases was 7.4e-6 N. That's six parts per
billion of a 1000 N load and utterly irrelevant physically — but it is not machine precision. I
rewrote the comment to state the real bound and say why chasing it further would be silly.
**A comment that overstates precision is a small lie that someone will later rely on.**

**Selecting a contact made it shrink.** The marker radius encodes load, and the CSS for the
selected state forced a fixed radius. Click the most-loaded contact and it got *smaller*. Caught
by looking, again. Fixed with a ring instead of a resize.

## Step 7 — Pitfalls

- **Notice indeterminacy yourself.** Nothing errors. Count unknowns against independent equations;
  if unknowns win, you have a modelling choice to make, and if you don't make it, your code makes
  it for you.
- **Give every optimiser a ceiling, not just a floor.** "This can't go negative" is half the
  physics. "This can't exceed what a person can do" is the other half, and its absence produces
  comfortable, wrong answers.
- **Warm-start Newton somewhere its derivative is informative.** The origin is often the worst
  possible starting point.
- **Armijo, not relative decrease.** The naive test breaks exactly where the objective is near
  zero, which is near the answer.
- **Cap iterations AND detect stalls.** They're different failures; only one is fixed by more
  iterations.
- **Don't claim machine precision unless you measured it.** State the bound you actually observed.
- **When calibration is unavoidable, say what you calibrated to.** Tuned-to-a-known-answer is
  legitimate. Silently tuned is not.

## Step 8 — What an expert notices

**An expert asks what the solution is optimal *for*.** Any answer satisfying the balance is
"valid." Only one is what an elastic structure does. A beginner tests the constraint and declares
victory; the constraint is the easy half.

**An expert reads the zeros.** The headline number here is 537 N in the shoulder belt during a
panic stop. The *informative* numbers are the two exact zeros in the belts at rest. A model that
loads everything a little is a model that isn't deciding anything.

**An expert distrusts an unbounded variable.** Any quantity with no upper limit will be exploited
by an optimiser to make its objective look good. Unlimited bracing was that variable here.

**An expert treats an unintended-but-correct result as evidence.** The bolster loading during a
straight-line stop wasn't designed. Emergent correctness is a much stronger signal than a passing
test, because you couldn't have accidentally written it.

**An expert makes guarantees structural rather than tested.** "No force is negative" isn't
asserted after the fact here; the clamp makes it unrepresentable. Whenever you can move a property
from *checked* to *impossible*, do.

## Step 9 — What transfers

**Look for the dual.** When a problem has many unknowns and few binding constraints, the answer
often lives in a space the size of the *constraints*, not the *unknowns*. Fourteen dials became
three. This shows up far past optimisation: in negotiation, the space of deals is huge but the
space of *binding issues* is small; solve there.

**Every optimiser needs a ceiling.** Give a system an objective and one unbounded lever, and it
will pull that lever. This is the shape of nearly every incentive failure, metric gaming and
reward-hacking story you have ever heard. Unlimited bracing was mine.

**Mathematically flawless is not physically complete.** Internal consistency proves your reasoning
follows from your assumptions, and nothing whatsoever about your assumptions. Only domain
knowledge closes that gap.

**Emergent correctness is the best evidence you have.** When a model produces something true you
didn't put in, your representation is capturing structure rather than encoding your expectations.
Actively look for these; they're worth more than a hundred passing assertions.

**Say what you calibrated to.** Tuning to a known answer is honest and often necessary. Tuning
silently turns your model into an elaborate way of restating what you already believed.

**Move guarantees from checked to impossible.** A test that catches a bad state is good. A
representation that cannot express one is better, and it never goes stale.

*Prepared by David Berkowitz. Research and drafting with Anthropic Claude. Illustrations from
Google Gemini Nano Banana.*

---
---

# Learning, part five: building M3, when it became a simulation

Three milestones of one frozen state. This is where it starts responding.

## Step 1 — Approach: one solve, everything downstream

The temptation with sliders is to wire each control to the thing it visibly affects. Steering
moves the lateral arrow. Brake moves the tyre patches. It feels direct and it is a trap, because
you end up with several places computing overlapping quantities, and the moment two of them
disagree you have a bug nobody can locate.

So the whole milestone is built on one function:

```
controls → inputs → vehicle → occupant → contacts → both views
```

One `solveAll()` per input change. The panel does not re-derive the g-load. The traction gauge
does not re-derive the friction utilisation — the app hands it the solved vehicle state. **Two
places computing the same number is two places to disagree**, and on a page with forty live
numbers that is not a hypothetical.

## Step 2 — Roads not taken

**Rejected: sliders that set accelerations.** The obvious API is a "lateral g" slider. It would
have been less code and it would have quietly destroyed the point. You cannot set 0.6 g. You turn
a wheel at a speed and the car works out what that costs, and sometimes the answer is *it can't*.
Making the inputs be **what a driver actually does** is what lets the friction ellipse mean
something.

**Rejected: faking grade as a fore-aft force.** I could have added `mass * g * sin(theta)` to the
longitudinal acceleration and called it a hill. It gives roughly right numbers for roughly wrong
reasons, and it breaks the moment you ask what the g-load is.

The honest version is that on a slope **the cabin is tilted, so gravity acquires a component
along the car's own x axis**. So `requiredForce` gained a gravity parameter, defaulting to
straight down. Two consequences fall straight out and both are checkable: a hill presses you into
the seat back while standing still, and standing on a 20% slope still reads exactly **1.00 g** —
same magnitude of gravity, just pointing somewhere else. A fudge would have got that second one
wrong and nobody would have noticed.

**Rejected: drawing all twelve contacts in both views.** The plan view shows six — the ones a
top-down view can show honestly. Drawing the seat pan from above adds no information the side
elevation lacks, and doubles the clutter. **Each view carries what it can be truthful about.**

**Rejected: leaving the tyre loads invisible.** The vehicle solver has computed per-corner loads
since M0 and nothing had ever drawn them. They are the clearest possible picture of weight
transfer, and the plan view had exactly the right shape to show them. Sometimes a milestone's
best feature is exposing something you already built.

## Step 3 — How the pieces connect

```
controls.js   what a driver does          (no physics)
   ↓
app.js        solveAll(), once per change (no drawing)
   ↓
vehicle.js → occupant.js → contacts.js    (no DOM)
   ↓
side.js + plan.js                          (no physics)
```

Every layer knows only its neighbours. The controls module cannot compute an acceleration; the
view modules cannot compute a force. That is what made the plan view cheap to add: it consumes
exactly the same solved objects the side view already consumed, and the touchpoint register it
draws from was built in M1 with **no coordinates in it**, precisely so a second view could place
the same twelve contacts differently.

That decision was made two milestones before it paid off. Most architectural decisions are like
that: the cost is immediate and the payoff is deferred, which is why they're easy to skip.

## Step 4 — Tradeoffs

| Chose | Gave up | Why |
|---|---|---|
| Inputs as driver actions | A simpler API | It's what makes the friction limit meaningful |
| Gravity as a parameter | A one-line grade fudge | The fudge gets the g-load wrong and hides it |
| Six contacts in plan | Symmetry with the side view | Each view shows only what it can show honestly |
| Full re-render per change | Diffing the SVG | ~60 nodes; correctness beats a speed nobody can perceive |
| Clamp and announce | Extrapolating past the limit | Past the ellipse the drawing describes nothing real |

## Step 5 — The mess

**The whole app failed to boot, and the error had nothing to do with physics.**

Blank page. Zero sliders, zero contacts. Every module had loaded — all eleven globals present —
and nothing had rendered. The console had one line:

```
InvalidCharacterError: Failed to execute 'setAttribute' on 'Element':
'0' is not a valid attribute name.
```

The cause is worth the retelling. I have two element helpers with the same name and **different
signatures**:

```js
V.el(tag, attrsObject, parent)   // builds SVG nodes
el(tag, classString, text)       // builds HTML nodes
```

In `controls.js` I wrote `var el = V.el` at the top, then used it to build HTML: `el('div',
'ctl-strip')`. The SVG helper dutifully iterated the string `'ctl-strip'`, took its character
index `0` as an attribute name, and threw. Because that happened during `mount()`, **the entire
boot died** — the sliders, both views, the panel, everything.

Two things to take from it. First, a single throw in a synchronous boot path takes down
everything after it; the blast radius of an error has nothing to do with the size of the mistake.
Second, and more the point: **two functions with the same name and different signatures is a trap
you will walk into.** The fix wasn't just correcting the call sites, it was renaming so the
collision cannot recur — the SVG one stays `V.el`, the HTML one is `dom()`, and a comment
explains why they're named for what they build.

**Then two layout bugs only a screenshot could show.** Plan-view labels ran off both edges of the
viewBox, clipped mid-word into "eering wheel 33 N". Fixed by authoring the drawing around a
convenient origin and shifting the whole scene at render time, rather than re-numbering forty
coordinates by hand.

And the lateral force arrow ran straight through the rear tyre-patch labels. Moved below the car
body entirely. Both tests-green. Both invisible except by looking.

**And I killed my own shell. Twice.** Running `pkill -f "http.server 8081"` in a command whose own
text contains that string — the pattern matched the shell running it. Exit code 144. The second
time it silently ate a commit I thought had landed.

## Step 6 — Pitfalls

- **Never give two functions the same name and different signatures.** Especially not across
  modules where one is aliased into the other's scope.
- **A throw during boot takes out everything downstream of it.** When a page renders *nothing*,
  suspect one early exception rather than many broken things.
- **`pkill -f` matches the process running it.** Use a pattern that can't match your own command
  line, or don't use it.
- **Author drawings around a convenient origin and translate at render time.** Re-numbering
  coordinates by hand to make room for a label is how geometry rots.
- **Make inputs the things a user actually controls.** The moment you expose a derived quantity as
  an input, you've removed the model's ability to say "that isn't possible."
- **When you add a parameter with a default, test that omitting it is unchanged.** There's a test
  asserting a call with no grade matches a call with `gradePercent: 0`, because every call site
  written before M3 depends on it.

## Step 7 — What an expert notices

**An expert checks the invariant that should NOT change.** Adding grade, the interesting
assertion isn't that forces shifted — it's that the g-load at rest is still exactly 1.00 on every
slope. Gravity tilted; it didn't shrink. Verifying what should stay fixed catches the errors that
verifying what should move will miss.

**An expert asks what each view is allowed to claim.** A profile cannot show lateral force. Once
you accept that, you either draw a second view or you draw a symbol that admits the limitation.
What you don't do is draw a plausible sideways arrow in a view that can't support one.

**An expert notices that the data model already supported this.** The touchpoint register had no
coordinates in it, deliberately, since M1. The second view cost almost nothing because of a
decision made before there was a second view to justify it.

**An expert reads a blank page as one error, not many.** Eleven globals loaded and nothing
rendered says "something threw early," not "eleven things are broken."

## Step 8 — What transfers

**One source of truth, recomputed, beats many sources kept in sync.** Kept-in-sync is a promise
you renew on every edit. Recomputed-from-one-place is a property of the structure. True of
spreadsheets, dashboards, and any document where the same figure appears twice.

**Model the mechanism, not the symptom.** Grade as tilted gravity took one extra parameter and got
two more things right for free. Grade as an added force would have looked identical on the main
screen and been wrong everywhere else. The shortcut and the real thing often agree on the case you
first check — that's exactly why the shortcut survives.

**Same name, different meaning, is a bug waiting for a deadline.** Two `el` functions cost an
entire boot. This is the software version of two teams using "active user" to mean different
things, and it fails the same way: quietly, until it doesn't.

**Expose what you already built before building more.** The tyre loads existed for three
milestones without being visible. The highest-value feature in this milestone was showing
something that was already there.

**Give the system a way to say "no."** The friction ellipse lets the model refuse. A design where
every input produces a confident output is a design that cannot tell you when you have left
reality, and users will believe it anyway.

*Prepared by David Berkowitz. Research and drafting with Anthropic Claude. Illustrations from
Google Gemini Nano Banana.*
