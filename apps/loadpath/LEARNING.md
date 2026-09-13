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

---

# Learning, part six: building M4, and the difference between a delay and a lie

M4 looked like the easy one. Play, pause, scrub, and smooth the figure out a bit
so it stops snapping around like a mannequin on a stick. Two afternoons of UI.

It was not the easy one, and the reason is worth the whole essay: **adding time
to a model exposes every place the model was only ever true at one instant.**

## Step 1 — Approach: playback is not a mode, it is a different input source

The first decision was the one that mattered, and I made it before writing a
line. There were two ways to build playback.

The tempting way: a `playScenario()` function that walks a timeline, computes
states, and draws them. Its own loop, its own solve, its own render.

The way I took: a scenario is **a timeline of the same five driver inputs the
sliders already produce**, and playback just feeds those into the existing chain.

Think of the difference like a player piano. The bad design builds a second
piano that plays itself. The good one puts a paper roll over the keys of the
piano you already have. Every note that comes out is a note the instrument could
already make — you have only changed what is pressing the keys.

This is not aesthetics. It means there is exactly one place in the codebase that
turns driver inputs into forces, so a bug in the physics shows up identically
whether you dragged a slider or pressed play, and a fix lands in both. The
alternative gives you two subtly diverging simulations and a class of bug where
"it only happens during playback" — the worst possible thing to debug, because
your reproduction case is a moving target.

## Step 2 — The lag, and why I nearly built it wrong twice

The plan had flagged, back at the failure-modes stage, that a quasi-static solve
redraws the body the instant the input moves. Real bodies arrive late. Fine: add
a lag.

**Wrong version one: lag the drawing.** Smooth the arrow lengths and the label
positions with an easing function. This is what a front-end instinct reaches for
and it is a lie dressed as polish. The numbers on screen would no longer be the
output of any solve — they would be a weighted average of two solves, which
corresponds to no physical state at all. Print one of those and you have
published a force that does not exist.

**Wrong version two: lag everything.** Put the filter at the top, between the
inputs and the vehicle solver, so the whole simulation smooths. Also wrong, in a
way that takes a second to see: the tyres are *bolted to the car*. A contact
patch does not arrive late to its own car's acceleration. Lagging the corner
loads would invent a compliance that does not exist.

**The right version** puts the filter in exactly one place, between the vehicle
and the occupant:

```
inputs -> vehicle (instantaneous) -> [LAG] -> occupant -> contact split
                    |
                    +-> tyre loads, friction gauge
```

The car's acceleration is what it is. The *body's* acceleration follows it
through a delay, because between the road and your torso sit a spring, a bushing,
a seat frame, four inches of foam and a lot of soft tissue. That delay is real
physics, not a rendering trick, and putting the filter there is what makes the
difference between a delay and a lie.

The visible payoff is that mid-maneuver **the two drawings deliberately
disagree**. The plan view's tyre loads have already transferred; the side
elevation's body is still coming. In the hero screenshot the cabin is pulling
0.20 g while the body is only at 0.11 g, and the panel prints the 0.09 g gap
between them by name. A reader who notices the disagreement and thinks "that's a
bug" has actually understood the model.

## Step 3 — Exact exponential, not Euler, and why that is not pedantry

The lag update could have been written two ways.

```js
cur += (target - cur) * (dt / tau);                // Euler
cur += (target - cur) * (1 - Math.exp(-dt / tau)); // exact
```

They agree when `dt` is much smaller than `tau`, and every tutorial uses the
first one. I used the second, and here is the scenario that decides it: someone
switches browser tabs for thirty seconds. `requestAnimationFrame` stops firing.
They come back, and the next frame arrives with `dt = 30`.

With `tau = 0.25`, the Euler form computes a step of `30 / 0.25 = 120`. It
multiplies the gap by **120** and flings the body a hundred times past its
target, then overcorrects the other way, and rings itself apart. The exponential
form computes `1 - e^(-120)`, which is 1.0, and snaps cleanly to the target —
which is exactly what you want, because thirty seconds is plenty of time for a
body to settle.

The lesson generalises past filters: **when a formula has a regime where it is
only approximately right, find out what happens at the edge of that regime before
you ship it.** A discretisation that is "fine for small `dt`" is a bomb with a
variable-length fuse, and in a browser you do not control `dt`.

There is a unit test that walks `dt` from 0.001 to a million and asserts the
coefficient stays inside `[0, 1]`. It would fail instantly on the Euler form.

## Step 4 — The test that stops the lag from becoming a bias

This is the single most important test in the milestone, and it took ten minutes
to write.

A lag is supposed to be a **transient**. It changes how you get somewhere; it
must not change where you end up. If the settled state with the lag on differs
at all from the settled state with it off, then the lag has stopped being a
visual nicety and started quietly biasing every newton the app prints.

So: run the lagged body forward 2000 steps, solve the contact split, solve it
again with no lag at all, and assert all twelve contacts agree to within 1e-6 N.

```js
Object.keys(direct.byTouchpoint).forEach((id) => {
  const d = Math.abs(lagged.byTouchpoint[id].magnitude -
                     direct.byTouchpoint[id].magnitude);
  assert.ok(d < 1e-6, `${id} differs by ${d} N once settled`);
});
```

I also verified it in the running browser, which caught something the unit test
structurally could not: the *app's* settled state has to match too. The frame
loop pins the lag exactly on target when it settles rather than leaving it
0.0001 away, and then **stops requesting frames**. Measured: 61 frames per
second while something is moving, **zero when nothing is**. That is not
politeness about battery life. It is what guarantees a screenshot of a settled
M4 state is bit-identical to the M3 state it replaced.

## Step 5 — The mess: two hours on an arithmetic problem I had created

Here is the part where it went wrong.

Speed and pedal demand are **independent inputs** in this model. Nothing
integrates one into the other — you set a speed, and separately you set a brake
pressure. That was fine for three milestones, because a slider is one instant and
an instant has no history.

A timeline has history. And a timeline can say: *100 km/h, constant, for six
seconds, with the brake at 0.8 g the whole time.* The solver will draw that with
a completely straight face. It is physically incoherent and it looks perfectly
plausible.

I decided not to fix it by integrating (that changes speed from an input into an
output, and rewrites three milestones of UI). I decided to fix it by **checking**:
differentiate the authored speed profile, compare it against the acceleration the
vehicle solver actually produces, and fail the build on a mismatch.

The first implementation compared at sampled instants with a centred difference.
Two of four scenarios failed:

```
threshold_stop disagrees by 3.916 m/s^2 at t=4.00:
  speed implies -3.929, pedals give -7.845
hill_start disagrees by 1.373 m/s^2 at t=2.55:
  speed implies 0.000, pedals give 1.373
```

My first instinct was to widen the tolerance. **That instinct was wrong and it is
worth knowing why.** A tolerance wide enough to swallow those (0.4 g) is wide
enough to swallow a genuine authoring blunder. I would have kept a test that
passes and detects nothing — which is worse than no test, because it buys false
confidence.

The failures were at *corners* in the speed profile, and the real cause was
structural: **speed interpolates linearly, so a speed segment asserts a constant
acceleration over its whole span.** Comparing that against the instantaneous
pedal value at some sampled midpoint is comparing the wrong two things. Anywhere
a pedal is ramping, or the profile has a kink, the sampled comparison disagrees
for reasons that have nothing to do with whether the scenario is correct.

The fix was to change what gets compared, not how loosely:

> For each stretch between consecutive speed keyframes, the slope the keyframes
> claim must equal the **mean** acceleration the solver produces over that same
> stretch.

Integrates ramps correctly. Puts the corners on segment boundaries where they
belong. Same tolerance, and now it means something. All four pass, and a negative
control — a deliberately incoherent timeline — is caught by 7.8 m/s^2.

**The transferable lesson: when a test fails, ask whether you are comparing the
right two quantities before you ask whether the threshold is too tight.** A
failing test is sometimes telling you your measurement is wrong, not your code.
Loosening it destroys the evidence.

## Step 6 — A model bug the scenarios forced into the open

Building the hill start surfaced something three milestones of sliders had never
reached.

A car held on the brake at a standstill. Speed zero, brake 0.30 g. The model
computed `ax = -0.30 g` and drew the stationary occupant being thrown forward at
a third of a gravity. Sitting at a red light.

The bug had been there since M0. It was unreachable because nobody drags the
speed slider to zero *and* the brake slider up and then stares at the figure. The
scenario did exactly that, for two full seconds, on purpose.

The fix is one line and one paragraph of comment: `ax` is pedal **demand**, and a
car with no speed left cannot supply a deceleration.

```js
if ((inputs.speed || 0) <= 0 && ax < 0) ax = 0;
```

Braking only — throttle from rest passes straight through, because that is how a
car leaves a standstill. And I wrote down what the fix does *not* claim, because
that is the half that gets forgotten: a real car held on a 12% slope genuinely is
spending longitudinal friction to stay put, and this model shows the traction
gauge at zero. Recorded as `MODEL.stoppedCar`, visible in the drawer.

**The lesson: a new mode of interaction is a fuzzer.** Scripted playback visited
input combinations no human had bothered to drag to, held them for seconds, and
found a defect that had been sitting in the code since the first day. If you want
to find bugs in a parameter space, stop sampling it by hand.

## Step 7 — Naming the limitation you just built

A first-order lag **can never overshoot**. It approaches its target
monotonically, always, by construction.

A real torso on a compliant seat is a second-order system — mass, stiffness,
damping — and it *does* overshoot. In a hard stop you rock forward past where you
end up and then settle back. Everyone has felt this.

So the model now gives you the delay and none of the rebound, and a hard stop
looks calmer than it feels. That is a real limitation, introduced deliberately,
in the same commit as the feature.

I did three things with it rather than one:

1. Wrote it into `MODEL.bodyLag` in the provenance registry, status
   `placeholder`, so it renders in the assumptions drawer alongside the other
   numbers you should not quote.
2. Wrote it into the plan's failure-mode card for the *mitigation itself* — the
   fix for one problem is now documented as the source of another.
3. Put it in a **unit test**, as the assertion that the monotone approach holds:

```js
assert.ok(v.x <= prev + 1e-12, 'first-order lag must not overshoot');
```

That test reads like it is protecting a nice property. It is really pinning down
a known inaccuracy so that nobody later "fixes" the ringing back in without
realising they have changed the model's order.

**Documenting a limitation in the same commit as the feature is the only time it
is cheap.** A week later you have stopped seeing it. A month later someone quotes
the number in a slide.

## Step 8 — What an expert notices here

Four things a beginner would miss:

- **Which quantity gets filtered.** Everyone reaches for a smoothing filter. Very
  few stop to ask *what*, physically, is compliant. The answer decides whether
  you have modelled something or faked it, and it is the difference between the
  tyres and the torso.

- **That the settled-state test is the real deliverable.** The lag is twenty
  lines. The test proving it changes nothing at equilibrium is what lets anyone
  trust a number printed while it is running.

- **That the frame loop must stop.** An always-on `requestAnimationFrame` is the
  default in every tutorial. A loop that shuts itself off when the scene is
  static is both cheaper and *epistemically* better: it makes "settled" an
  observable state of the program rather than an approximate visual impression.

- **That independent inputs need a consistency invariant the moment you add
  time.** Two free variables that ought to be related are harmless at one
  instant. Over an interval they can contradict each other, and nothing will tell
  you unless you write the check.

## Step 9 — What transfers

**Adding a time dimension audits your model for free.** Everything that was only
true at one instant gets held for seconds and stared at. The stopped-car bug had
survived three milestones and 136 tests; a two-second hold at zero speed killed
it. If you have a model you are unsure about, run it *over time* before you run
it over more cases.

**Find the edge of your approximation before shipping it.** "Fine for small `dt`"
means "there exists a `dt` that breaks it," and in a browser you do not choose
`dt`. Ask what happens at the edge — the fix is usually one `Math.exp` away, and
the bug it prevents is one you would have debugged at 2 a.m.

**When a test fails, suspect the comparison before the threshold.** Widening a
tolerance to make a red test green is the most common way to end up with a test
suite that detects nothing. Twice in this milestone the right move was to change
*what* was being compared and keep the tolerance exactly where it was.

**Write the limitation into the same commit as the feature.** Not the next PR,
not the docs sprint. You will never understand the thing's weaknesses better than
in the hour you finished building it, and the cost of writing them down then is
about four minutes.

**New interaction modes are fuzzers.** Playback found a latent defect by visiting
a corner of the input space no hand-dragging had reached. Any new way of driving
a system — a script, an API, a batch mode — is worth running specifically to see
what falls out, independent of whether anyone asked for it.

---

# Learning, part seven: building M5, and what a standard actually buys you

M5 was the one the plan had been warning about since before any code existed. There
was a failure-mode card written at planning time that said: load transfer is a
time-domain balance, whole-body vibration is a frequency-domain weighted RMS, and
merging them gives you something that satisfies neither.

That card turned out to be right, but not in the way I expected. The hard part
wasn't keeping the mathematics apart. It was deciding **how much of an answer I was
entitled to publish.**

## Step 1 — The first decision was a scoping decision, not a coding one

Whole-body vibration has a chain: road → wheel → suspension → seat → body →
weighting → RMS → comfort band. Eight stages.

I could have built all eight at full fidelity. A proper multi-body ride model, a
detailed seat-cushion model, measured tyre data. Weeks of work, and — this is the
part that matters — **every additional stage is another place to be wrong, and
the wrongness compounds silently.** Eight stages each 20% off don't give you a
20% error. They give you a number with no relationship to reality wearing an ISO
label.

So the scoping question was: which stages are actually *standardised*, and which
are me guessing?

- ISO 8608 road PSD: standardised.
- Frequency transform, double differentiation, RMS integration: exact mathematics.
- ISO 2631-1 weighting and comfort bands: standardised.
- Everything between the tyre and the body: **me guessing.**

That split told me where to spend effort. I built the standardised parts
carefully and the guessed part *deliberately small* — one quarter car, one seat
mode. Not because a bigger model would be harder, but because a bigger guess is
a worse guess dressed as a better one.

Think of it like a chain of translators. If six of them are professionals and
two are using a phrasebook, you don't fix the translation by hiring four more
phrasebook users.

## Step 2 — I checked the numbers I "knew," and one of them was wrong

I could have written the ISO 2631-1 filter coefficients from memory. I was fairly
confident: high-pass at 0.4, low-pass at 100, transition at 12.5 for Wk, and an
upward step at 2.5 and 0.25 Hz.

I searched anyway. The actual step frequencies are **2.37 and 3.35 Hz**, both with
Q = 0.91. My recalled 2.5 and 0.25 was wrong, and not trivially — 0.25 Hz is
below the high-pass corner, so that version of the curve would have had the wrong
shape across the entire low-frequency region.

This is the second time in this project that a confidently-held number was wrong.
The first was the Wk/Wd axis assignment at M0. The pattern is worth naming:
**the numbers you are most confident about are the ones you check last, which is
exactly backwards.** Confidence is not evidence. It is a feeling about evidence
you can no longer inspect.

What I could NOT get was ISO's own published table of weighting factors at
one-third-octave centres — every source that had it was behind an egress block.
So the curves are implemented from one third-party implementation and checked for
*structure* rather than validated against the standard's numbers. That limitation
is in the provenance record, in the test file's header comment, and in the README.
A test suite that looks thorough is its own way of overclaiming.

## Step 3 — The self-check when you cannot check against the source

No table to compare against. So what can you assert?

**Structure.** The ISO curves have properties that follow from what they're for:

- Each peaks at exactly 1.0 (so I normalise to that, which also removes my
  dependence on the standard's internal gain constants — a problem turned into a
  convention).
- Wk peaks in the 4–12.5 Hz plateau, because that's where a seated body is most
  sensitive.
- Wd peaks below 2 Hz and falls at −6 dB/octave above.
- Wk carries a 2× upward step; Wd carries none.

And then the one that matters most, given this project's history:

```js
test('THE SWAP TEST: Wk and Wd cannot be exchanged without this going red', () => {
  assert.ok(V.Wk(8) / V.Wd(8) > 3, 'Wk must dominate at 8 Hz');
  assert.ok(V.Wd(0.8) / V.Wk(0.8) > 1.8, 'Wd must dominate below 1 Hz');
});
```

That test exists because **this project already made that exact mistake once.** A
test aimed at a specific documented failure is worth ten generic ones. I verified
it by actually swapping the two functions: six tests went red.

The general lesson: when you can't validate against ground truth, validate
against *structure* — and be loud about which one you did.

## Step 4 — The mess, part one: I deleted my own work with a git command

Mid-milestone I ran a negative control by deliberately breaking a constant, then
cleaned up with:

```bash
git checkout -- apps/loadpath/js/model/constants.js
```

That restored the file to **HEAD** — which predated every M5 constant I'd written
that session. About 150 lines of constants and provenance records, gone in one
command that I typed without thinking, because it's the command I always use.

`git checkout --` doesn't undo your last edit. It undoes *everything since the
last commit.* I knew that. I still did it, because I was thinking of it as "undo
the thing I just did" rather than as what it actually is.

Two takeaways, and the second is the useful one:

1. Never use `git checkout --` as an undo for a deliberate experiment. Copy the
   file to a scratch path first, or make the experiment in a scratch copy.
2. **Commit before you run destructive experiments**, not after. The cost of an
   extra commit is nothing. The cost of not having one is however long it takes
   to rebuild what you lost — in this case, twenty minutes and a lot of care to
   get the provenance text back verbatim.

## Step 5 — The mess, part two: two tests that tested nothing

Here's the more interesting failure.

The first version of the ride model had no unsprung mass, so no wheel hop. I
noticed, fixed it with a proper quarter car, and wrote two tests to guard the fix.
All 29 tests passed.

Then I ran the negative control — gutted the unsprung mass to see the tests go
red. **They didn't. 29 of 29 still passed.**

Both guards were duds:

- One asserted the wheel-hop band carries more than 5% of the energy. The gutted
  model still shows 5.9%, because that band contains *some* energy regardless of
  whether there's a resonance in it.
- The other compared the response slope through 10–13 Hz against 16–22 Hz,
  expecting the resonance to make the first shallower. But slopes steepen with
  frequency in any low-pass system, resonance or not. The comparison passed both
  ways.

I fixed them by *measuring the separation first*:

```
                      hop band share   log-log slope 16-22 Hz
   mu = 40 kg              14.2%              -7.60
   mu -> 0                  5.9%              -2.81
```

Then setting thresholds between those two columns instead of guessing. Now
gutting the mass fails two tests.

**A test you have never seen fail is a hypothesis, not a test.** The only way to
know a guard works is to break the thing it guards. This takes about ninety
seconds and it is the single highest-return habit in this whole project.

## Step 6 — The temptation I turned down, and why

When the chain was finished, class B asphalt at 100 km/h gave a_v ≈ 0.17 m/s².
Literature suggests real cars read more like 0.3–0.5.

I could have nudged the placeholders until it landed there. Nobody would ever
know, the output would look more credible, and I'd already done something
*similar* at M2 (tuning contact stiffnesses to a published pressure
distribution).

I didn't, and the difference between the two cases is the whole point:

- **At M2 I tuned to a sourced target** and recorded that I had. The tuning was
  itself a piece of information: "these stiffnesses reproduce this published
  finding."
- **At M5 I had no sourced target.** The measurement papers were egress-blocked.
  I had a half-remembered range. Tuning to a remembered number produces a model
  that agrees with my memory — which is not evidence of anything, and which
  destroys the one useful property the untuned number has: that *nothing was bent
  to make it land anywhere.*

So the number stays low and the drawer says the chain has never been validated
end to end. An honest 0.17 that says "unvalidated" beats a flattering 0.35 that
implies otherwise.

What I did instead was fix a *structural* omission — the missing unsprung mass.
That's legitimate because it corrects the model, not the output. It moved the
answer 13%, which is not enough to close the gap, and I wrote that down too,
including the fact that I'd expected it to matter more.

## Step 7 — The chart, and three things that were wrong on sight

Tests don't catch layout. I rendered it and looked, and found three problems the
green suite had nothing to say about:

**The normalisation was backwards.** Both traces were scaled to their shared
maximum. The unweighted peak is about 4× the weighted one, so the trace that
matters got squashed into the bottom third — the chart was mostly showing the
curve it was meant to contrast *against*. Fixed by normalising to the weighted
peak and letting the unweighted run off the top.

**Clipping drew a fake plateau.** My first fix clamped the y coordinate to the
frame top, which made the over-range part of the trace draw as a flat line along
the ceiling. That *reads as data.* It looks like the spectrum flattens out up
there, and it doesn't. Replaced with a real SVG `clipPath` so the trace genuinely
disappears. **Anything on a chart that looks like a measurement has to be one.**

**The band labels sat exactly where the curves peak.** They were inside the plot
at the top; the two lobes and the dashed trace ran straight through the words.
Moved above the frame entirely, where nothing can ever collide with them.

And a fourth, in the panel: I'd computed "horizontal share" as an *amplitude*
ratio, which read 64%. But orthogonal components don't decompose that way —
amplitude ratios of perpendicular axes don't sum to one. The energy share is 41%,
which is the number a reader will assume they're being shown.

## Step 8 — What an expert notices

- **Which stages are standardised.** A novice builds all eight stages to the same
  fidelity. An expert notices that four of them are exact, two are citable, and
  two are guesses, and puts the effort — and the caveats — accordingly.

- **That "it passed" is not "it works."** Every test in this milestone passed on
  first run. Two of them tested nothing. The gap between those two facts is where
  the work is.

- **Overlapping bands are information.** ISO's comfort scale lists 0.5–1.0 and
  0.8–1.6 as separate bands, so 0.9 is in both. That's the standard telling you
  how precise it is. Collapsing it to one crisp label is discarding data to look
  more confident.

- **Reserved colours stay reserved.** `--act` red and `--react` blue mean
  direction of action on a force. Vibration has no direction and is not a force,
  so it gets a third hue. Reusing one of the two would have silently claimed the
  quantities were the same kind of thing.

## Step 9 — What transfers

**Match your model's complexity to your weakest input, not your strongest.** A
chain is only as good as its worst link, and adding detail downstream of a guess
makes the guess harder to see, not smaller.

**Check the numbers you're sure about.** Twice now, in this project, a
confidently-recalled constant was wrong. Confidence is a feeling about evidence
you can no longer inspect. The check costs a minute.

**Break every guard at least once.** A test that has never failed is an
untested test. Gut the thing it protects and watch it go red, or you don't know
what you have.

**Commit before destructive experiments.** `git checkout --` is not an undo
button; it's a "discard everything since the last commit" button. The habit that
saves you is committing more often, not typing more carefully.

**Don't tune to a number you can't cite.** Tuning to a *sourced* target is
calibration and you record it. Tuning to a remembered one is fabrication with
extra steps, and it destroys the only thing an untuned output is good for.

**Render it and look at it.** Four real defects in this milestone were invisible
to a green test suite and obvious within two seconds of opening the page.

---

# Learning, part eight: M6, and the difference between a gate and a formality

## Step 1 — What I set out to do, and the one sentence that governed all of it

The plan had a gate written into it, months of milestones earlier:

> If the M6 prototype does not look credible next to the 2D view, cut it and
> ship the 2D view alone. That is a real outcome, not a failure.

Most gates in most plans are decoration. Somebody writes "we'll evaluate and
decide" because it sounds rigorous, and then evaluation day arrives, the thing
has been built, and of course it ships — nobody deletes a week of work over a
feeling. The gate exists to make the decision look considered, not to make it.

The only way a gate is real is if you can say what would fail it *before* you
look, and then actually look. This one could: the failure mode was named. A
procedural human body will look wrong, and a body that looks wrong will
undermine numbers that are right. That is specific enough to test.

So my starting point was not "build the 3D view." It was "build enough of the
3D view to find out whether the named failure mode happens." Those produce
different code. The second one is allowed to be rough everywhere the gate isn't
looking, and has to be honest exactly where it is.

## Step 2 — The approach I took, and the trapdoor in it

I made two departures from the plan immediately.

**No three.js.** The app has no dependencies, no build step, and runs by opening
a file. The README promises that out loud. Adding a 3D library for a view the
plan says might be cut spends the project's cleanest property on its least
certain milestone. What a 3D view actually needs is: rotate points, project
them, sort by depth. That is about a hundred lines. I wrote them.

I still think this was right, and I'd do it again.

**No mesh — a stick skeleton instead.** Here is where I was clever, and being
clever is how you walk into a trapdoor. My reasoning went: the gate warns about
a procedural *human*. Nothing else in this app is figurative — the side
elevation and the plan are drafting diagrams. So a 3D drawing in the same
language, a stick skeleton with joints and bones, cannot fail the way a failed
human fails, because it isn't attempting a human. It's attempting a drawing, and
it should be held to a drawing's standard.

That argument is coherent. It is also, in retrospect, a very elaborate way of
saying "the gate doesn't apply to me." Which is exactly what everyone says.

## Step 3 — What the render actually showed, which is the whole point of rendering it

I built it: nineteen joints, eighteen bones, reclined torso, thighs forward,
one foot on the pedals and one on the footrest, because a real driver's legs are
not symmetric. Twelve contact markers sized by the load crossing them. Seat
planes, a steering wheel ring, a ground grid, an axis tripod. Fifteen tests.
All green. Zero JS errors. Then I drove a headless browser to a combined
brake-and-turn — the case that justifies the view existing — and looked at it.

It read as a stick insect.

Not catastrophically. If you already knew it was a seated driver you could
reconstruct it: that's the torso, those are arms reaching to the wheel, those are
legs going down to the pedals. But *knowing in order to see* is precisely the
failure. The side elevation next to it needs no such favour; you look at it and
a person is sitting in a car.

I tried six camera angles. Not one of them fixed it. The arms splay into an open
V at every yaw between −0.4 and −1.25 radians, because from any three-quarter
view a pair of arms reaching forward and outward to a wheel is a shape with no
silhouette. That is geometry, not tuning.

So: the gate fired. On a stick skeleton, not a mesh, for exactly the reason the
gate named.

## Step 4 — The mess: I made it worse before I made it better, and I nearly blamed the concept

Between the first render and the verdict I did two rounds of changes, and the
second round was worse than what it replaced. I made the seat panels opaque, so
they swallowed the skeleton. I scaled the scene up past its container, so the
legs ran off the bottom and the caption vanished. I put the new projection
labels at the projected arrow tips, which in a scene that is dense in the middle
by construction meant printing words across the torso.

And then I very nearly wrote the verdict.

This is the part I want to remember. I had a clean narrative available — "the
prototype failed the gate" — and a render in front of me that supported it, and
the render was bad *because of changes I had just made*. If I had written the
verdict there, it would have been a true conclusion reached by a corrupt route,
and I would not have known the difference.

What I did instead was boring and correct: fix my own mistakes first, render
again, and only then judge. The concept doesn't get blamed for my scaling bug.

After the fixes, the render was much better — and the skeleton was still a
zigzag. Same verdict, now actually earned.

## Step 5 — The experiment that settled it, which took ninety seconds

I stopped arguing with myself and ran the obvious test. I injected three lines
of CSS into the live page — `.sc-bone, .sc-joint, .sc-head { display: none }` —
and re-rendered.

It was immediately, unambiguously better. Seat planes, floor, steering wheel,
twelve contact markers where the car actually touches a driver, the force vector
and its projections. It looked like it belonged beside the other two drawings.

Ninety seconds of CSS answered a question I'd been circling for two rounds of
real edits. The lesson isn't "use CSS." It's that when you're asking "is it X
that's wrong, or the whole thing?", the cheapest possible version of *delete X
and look* usually exists, and you should reach for it before you reach for a
refactor or a verdict.

So the verdict split. Not go, not no-go: **the view goes, the body is cut.**

## Step 6 — The thing that actually made the view worth keeping, which the plan never specified

Cutting the skeleton left a problem the plan never anticipated. Without a body,
what is the view *for*? "Here is a 3D picture" is not a reason. The plan's answer
was that the side elevation carries x and z, the plan carries x and y, and
neither can show the true direction of a force that has all three components at
once — which the side view has admitted with a ⊗ symbol since M1.

Fine. But I drew that vector, and then I looked at the number: 976 N total, of
which 765 N is just holding the body up against gravity. So the arrow points
very nearly straight up. In steady cruise it also points very nearly straight
up. A viewer cannot tell the combined case from the boring case by looking.

The caption was asserting the gap. The picture was not showing it. And a caption
cannot be wrong in a way that anything notices.

The fix is the thing I'm most pleased with in this milestone. Draw the same
vector three times, from one origin, at one scale:

- whole — the real force;
- with the lateral axis zeroed — everything the side elevation can hold;
- with the vertical zeroed — everything the plan can hold.

Same scale is what makes it work. The projections come out visibly shorter,
visibly pointing elsewhere, and a thin line from each projected tip to the true
tip is the discarded component, drawn. Each gets a label: the angle the force
leans out of that drawing's plane, `asin` of the component it cannot hold. In a
combined brake-and-turn, the side elevation misses 31° of the force and the plan
misses 52°.

That is the ⊗ finally measured instead of admitted. It is the only reason this
view earns a place beside two drawings that were already doing their jobs — and
the plan didn't ask for it. Prototypes are supposed to teach you things the plan
didn't know.

## Step 7 — Three bugs, and what each one says about how I was checking

**The label that was a lie.** Under the resultant I'd hard-coded
"all three axes at once". True for the combined case I wrote it against. In
steady cruise the force is 765 N of pure weight support — one axis — sitting
under a label claiming three. No test caught it, because I hadn't written a test
for a string I'd typed by hand. It's now derived from the components (any axis
under 1% of the resultant is rounding, not an axis) and there's a test with five
cases. **A label that doesn't come from the data is a caption impersonating a
readout.**

**The tripod that silently collapsed.** The axis tripod was drawn by projecting
two points and subtracting the frame centre — which works only while the
projector maps the world origin to the frame centre. I added a framing offset to
stop the drawing sitting in the right half of an empty frame, and the tripod
quietly folded into a corner with z invisible. All tests still passed: they
exercise the projector, which was fine. They don't look at the legend. It's now
drawn from screen *deltas*, which have no origin to get wrong.

**The one that matters most: the views that never hid.** The 2D/3D switch set
`hidden` on the figures, and I verified it by reading the property back — which
returned `true`, so I moved on. But `.figures { display: flex }` in the
stylesheet beats the browser's `[hidden] { display: none }`, because any author
rule wins. The 2D drawings were painted the whole time, at every width. I only
found it in a phone screenshot, where they appeared below the 3D pane instead of
scrolled off the bottom of a desktop.

**I checked the property and the property was not the thing.** The thing was
whether pixels were painted. Every subsequent check in this milestone measures
`getBoundingClientRect().height` and computed `display` instead — what is on
screen, not what the DOM says should be.

## Step 8 — What an expert notices here

**A passing test suite is a statement about the claims you thought to write
down.** The skeleton had two tests: no bone references a missing joint, and the
body is symmetric everywhere except the legs. Both correct, both green, both
irrelevant to the question on trial. Green tests told me it was self-consistent.
Nothing in the repository could tell me it was illegible. That required a
screenshot and a judgement, and no amount of coverage substitutes for it.

**Gravity swamps the signal, and that's a design fact, not a physics fact.**
Everyone knows the weight term dominates a 1-g-ish load case. Fewer people
notice what it means for a *drawing*: if your one visual channel is arrow
direction, and 78% of the magnitude is a constant pointing up, then the channel
carries almost no information. Recognising that the picture was uninformative
even though the number was right is the difference between shipping a chart and
shipping a decoration.

**Right conclusion, corrupt route, and knowing the difference.** I nearly wrote
the correct verdict off a render I had personally broken. The conclusion would
have survived review — the skeleton really did fail — and I still would have
been reasoning badly. Experts separate "was I right?" from "was I entitled to
be?", because only the second one generalises.

**Same-scale is the whole trick.** Drawing a projection at its own convenient
size would have made a prettier figure and destroyed the argument. The claim is
about *how much* each drawing misses; the shortening is the evidence. Preserving
a common scale across compared quantities is the single most reliable thing that
separates an honest chart from a persuasive one.

## Step 9 — What transfers

**Write the failure condition before you build the thing.** A gate that says
"we'll evaluate" evaluates nothing. A gate that says "procedural bodies look
wrong, and a wrong-looking body undermines right numbers" is a prediction, and
predictions can fire. When you plan anything with an uncertain outcome — a
migration, a rewrite, a hire, a feature — write down in advance what would make
you stop. Then you only have to be honest once, instead of brave later.

**"That warning doesn't apply to my version" is what everyone says.** I
substituted a stick skeleton for a mesh and argued the gate was about meshes. The
argument was coherent and wrong. When you find yourself constructing a careful
case for why a known failure mode exempts you, that is data about you, not about
the failure mode.

**Fix your own mess before you judge the work.** The gap between "this is bad"
and "I made this bad in the last twenty minutes" is invisible from inside. Undo
your recent changes, look again, *then* decide.

**The cheapest possible experiment usually exists.** Before a refactor or a
verdict, ask: what's the crudest thing that would answer this? Three lines of
injected CSS settled a question two rounds of real edits hadn't.

**Check the outcome, not the mechanism.** `hidden === true` is a mechanism.
"Is it painted?" is the outcome. Assertions that read back the flag you just set
are the most common way a green suite lies — they test that assignment works.

**Partial cuts are usually the right answer.** The gate offered go or no-go. The
truth was that one half was excellent and the other half was a liability, and
shipping is not a package deal. Most "should we ship this?" arguments are
actually unasked questions about which part.

**Prototypes are supposed to surprise you.** The best thing in this milestone —
the decomposition with its measured angles — is not in the plan. The plan said
build a figure to show a vector. Building it taught me the vector needed showing
in a way a figure couldn't do. If a prototype only confirms the plan, you
learned nothing and could have skipped it.

---

# Learning, part nine: M7, and the difference between a caveat and an obligation

## Step 1 — There was no M7, and that is where this starts

You said "build M7." The plan runs M0 to M6 and M6 had just shipped. There was no M7 to build.

The lazy move is to invent one — pick something plausible-sounding, build it, call it a milestone.
The other lazy move is to stop and ask. I did neither, because the plan already had an answer in
it, in a section most plans don't have and most people don't re-read: **"Where this breaks."**

That section is a list of things the project knows are wrong with itself. Most of the entries are
*caveats* — here is a limitation, here is how we mitigate it, carry on. But one was not a caveat.
It was an **obligation**, with a trigger condition:

> "Before the presets reach a user-facing control, either source sex-specific fractions or relabel
> the control as a mass slider and stop implying it models a different body."

That is a promise with an if-then. And when I went to check whether the if had fired, it had —
seven milestones ago. `--driver f05`, labelled "5th percentile female", had been in the documented
command line since M0.

**The lesson is the distinction.** A caveat says "this is imperfect." An obligation says "this
becomes unacceptable when X happens." They look identical sitting in a document. Only one of them
has a tripwire, and nobody had checked whether it had been stepped on.

## Step 2 — Why the label was the bug, not the numbers

This is worth being precise about, because it sounds like pedantry and isn't.

The model computes forces on a body by taking a total mass and splitting it into segments — head,
trunk, thigh — using fixed fractions. Those fractions come from Dempster, 1955, a sample of nine
male cadavers. Changing the total mass scales every segment by the same amount. The proportions
never move.

So a "5th percentile female" preset was a 49 kg person with a man's proportions. Nothing about the
*arithmetic* was wrong — 49 kg is a fine number and the forces it produces are as right as the
model gets. What was wrong was the **claim on the label**. It told a reader the simulation could
model a woman's body, and it can't, and there is no way to tell from the output.

A number with a label is two assertions, and people check the first one.

## Step 3 — I tried the good branch first, and failed honestly

The plan offered two routes: source real sex-specific fractions, or drop the labels. The first is
strictly better — it would make the app do the thing the label claimed.

De Leva (1996), "Adjustments to Zatsiorsky-Seluyanov's segment inertia parameters," is the
canonical source and carries both sexes. I went after it: four search passes, six candidate hosts,
including a direct hit on the actual PDF. Every one blocked by the network proxy — 403 at the
CONNECT, same wall the ISO vibration tables hit in M5.

Here is the part that matters. **I know roughly what those numbers are.** I could have written
down a female trunk fraction that would have looked entirely credible and been quietly wrong in
the third decimal. M5 taught me exactly this lesson at exactly this cost: I "knew" the ISO Wk
filter had corners at 2.5 and 0.25 Hz, and the real values are 2.37 and 3.35 Hz, and my version
would have had the wrong shape across the whole low-frequency region.

Recalled precision is not precision. It is a guess wearing a citation.

So: fallback branch, and the failure written into the record rather than papered over.

## Step 4 — The mistake I nearly made, caught by measuring instead of reasoning

Having decided mass was "just a scale factor," I started writing the test that would prove it:
double the mass, double every contact force. Clean, obvious, and it would have *failed*.

Before writing it I ran a sweep, because it was cheap. And the table came back strange:

```
 mass   total  N/kg   shoulder belt   footrest
   78     976  12.51        0            250
   96    1189  12.51        0            250
   98    1225  12.51      589             48
```

Total force per kilogram: constant, dead flat, exactly as expected. The *split*: nothing like it.
Between 96 and 98 kg the shoulder belt goes from carrying nothing to carrying 589 N, and the
footrest — which was pinned at its limit — **drops to a fifth of what it was**.

The cause is one line I'd read a dozen times without registering: the bracing caps are absolute
newtons. `cap: 250`. Not `0.32 × bodyMass`. And that is *correct physics* — a heavier person does
not come with proportionally stronger arms. A hand on a wheel rim pushes about so hard whoever it
belongs to.

So demand scales with mass and the budget to resist it doesn't. Every maneuver has a mass where
the driver runs out of arm and leg and the car's structure takes over. Below it you hold yourself;
above it the belt holds you.

**That behaviour had been in the model since M2 and nothing had ever seen it**, because the
occupant was hard-coded at 78 kg for six milestones. A constant input hid a threshold.

I'd have shipped a wrong test on a right-sounding assumption if the sweep hadn't been cheaper than
the reasoning.

## Step 5 — The bug a screenshot caught that seven tests missed

I wired the slider, ran the suite green, drove the browser, took a screenshot. The slider read
**110 kg**. The header read **78 kg**.

A scenario timeline carries the channels a driver *operates* — speed, steering, pedals, grade. Not
occupant mass, deliberately: who is sitting there doesn't change halfway through a lane change.
But that meant loading a preset replaced the whole input object, `inputs.bodyMass` came back
undefined, and the solve fell through to the default. Every force on screen belonged to a 78 kg
occupant while the control insisted on 110.

This is the *same failure* I'd fixed one milestone earlier — in M6 I made the 3D legend and the
narrow-screen readout come from one return value so they couldn't disagree about a number. Then I
recreated it one milestone later by a completely different route.

**Knowing a failure mode does not immunise you against it.** It shows up somewhere you weren't
looking, wearing different clothes.

## Step 6 — The mutation test that lied in the reassuring direction

I mutation-check new tests now — deliberately break the code, confirm the tests scream. Four
mutations. Three fired. One reported **zero failures**: removing a bracing cap entirely, which
should have been catastrophic.

My first instinct was that I'd found a hole in the suite. Before writing that down I checked
whether the mutation had actually applied.

It hadn't. My `sed` pattern didn't match the file's whitespace. It silently changed nothing, the
tests passed because the code was untouched, and the report said "0 failing" — which I read as
"your tests are blind." With the edit genuinely applied, **seven tests fail**.

So: I nearly recorded a false weakness, from a broken harness, in the exact tool I use to check
for false strength.

**A negative result needs the same verification as a positive one.** "Nothing happened" is a
finding, and findings have to be earned.

## Step 7 — The thing I found and chose not to fix

Sweeping mass at 0.1 kg meant asking the contact solver the same question nine hundred times —
the first time anything had. About 4% of masses converge to ~1e-6 N where 1e-12 is typical, and
the worst case is only twice inside the tolerance the plan publishes.

Thirty-nine of the forty match a stall the solver's own comment predicts: two channels pinned at
their caps, the Hessian loses rank, the active set chatters. One doesn't — at the light end it
exits after a *single* iteration with nothing saturated, and it's the worst of the sweep. The
code's stated cause is not the whole story.

I recorded it and left it. Six micronewtons on a load of five hundred is orders of magnitude below
anything this model can claim to know, and tightening a solver inside its own published tolerance
is not what M7 was for.

But I wrote the test to assert **two** things: the bound holds everywhere, *and* the coarse cases
stay rare. A loose bound alone would pass just as happily if the solver degraded across the board.

**A tolerance you widen to make a test pass is a tolerance that now detects nothing.** If you must
accept a weaker bound, add a second assertion that catches the failure the first one stopped
catching.

## Step 8 — What an expert notices here

**Constant inputs hide behaviour.** The bracing threshold was computable from day one. Nobody
could see it because one parameter never moved. When you hard-code something "for now," you are
not just deferring a feature — you are blinding yourself to everything that depends on it varying.
Ask what your fixed values are concealing.

**The tripwire nobody watches.** "We'll fix this before X" is the most common unkept promise in
engineering, not because people are dishonest but because nobody schedules a check for X. If a
condition makes something unacceptable, something automated has to watch for it. Which is why M7's
deliverable includes a test that scans user-facing strings for a percentile or a sex — the next
person to add a friendly-sounding preset will not have read the provenance record.

**A CLI is an interface.** The obligation said "before the presets reach a user-facing control."
It had been reached for seven milestones, through a command line nobody had counted. Ask what
surfaces you're not counting: the CLI, the API response, the log line, the error message.

**Guard the claim, not the prose.** My first honesty test flagged three lines of the very comments
explaining why the labels were retired. A guard that punishes documenting the fix is worse than no
guard. It strips comments now and scans only what a reader can see — explain the history at any
length, just don't ship the claim.

## Step 9 — What transfers

**Re-read your own known-issues list looking for if-then, not for regret.** Most entries are
"this is imperfect." A few are "this becomes wrong when X." Those are different documents sharing
a page, and only one of them needs a calendar.

**When you can't source it, don't approximate it — relabel it.** Being unable to get the real
number does not license inventing one. The honest move is to reduce the claim to what you can
support. A 49 kg mass is true. A "5th percentile female" was not.

**Cheap measurement beats confident reasoning, every time.** I was one keystroke from a wrong test
built on a right-sounding assumption. The sweep took nine seconds.

**Verify the negative result.** "The test didn't fire" and "the test can't fire" look identical.
So do "nothing changed" and "my change didn't apply."

**Knowing a failure mode is not protection from it.** I fixed two-sources-of-one-number in M6 and
recreated it in M7 by a different route. Systems bite where you aren't looking, which is by
definition not where you just finished looking.

**Fixed parameters are unasked questions.** Every hard-coded constant in your system is a variable
somebody decided not to think about yet. At least one of them is hiding something interesting.
