# Driver Load Path

A browser simulation of every force a car and its driver push through each other, at each of
the twelve places where they touch.

**Status: M0 built and green.** The model core runs headless with 57 passing tests. There is no
interface yet, on purpose — see *Milestones* below. The full build plan is in
[`PLAN.html`](PLAN.html) — open it in a browser. It carries the physics, the touchpoint
register, the architecture, the milestones, the failure modes, and the source provenance for
every default value.

![The load path, tire contact patch to occupant](images/01-load-path-hero.png)

## The idea

The tires generate a force at the road. That force travels up through the suspension, into the
body shell, into the seat mounts, into the foam, and finally into you. Structural engineers
call that chain the *load path*. This simulation draws it, in both directions — including the
half that driving visualizations usually skip, which is the equal and opposite force the driver
pushes back into the car.

## Scope, as decided

| Dimension | Decision |
|---|---|
| Fidelity | Real numbers, simplified model. Quasi-static rigid body vehicle, segmented occupant. |
| Views | 2D side elevation and plan view primary; 3D toggle behind a go/no-go gate. |
| Regimes | Steady cruise, cornering, braking, acceleration, road vibration. |
| Control | Live sliders plus scripted playback. |

Emergency and crash loading is explicitly **out of scope**. Different data sources, much higher
stakes on accuracy, and it deserves its own project if it is ever wanted.

## Known limitation in the anthropometry

Building M0 surfaced a contradiction the plan did not have. The occupant presets offer a 5th
percentile female, but the body-segment mass fractions they are all multiplied by come from
Dempster's 1955 sample of **nine male white cadavers**. Changing total mass does not change the
proportions, so the "female" preset is a scaled male. The caveat now travels with the numbers in
`constants.js` and prints on every report run. It must be resolved before those presets reach a
user-facing control.

## The hard part

The total force on the occupant is determined by Newton's second law. The *split* of that force
across bolster, belt, footrest, knee and wheel is not — the system is statically indeterminate.
The plan resolves it as a stiffness-weighted least-norm problem with unilateral sign constraints,
because foam cannot pull and webbing cannot push. That solver is milestone 2, not milestone 6.

## Milestones

| | | |
|---|---|---|
| **M0** | Model core, headless | **done** — 57 tests green |
| M1 | Side elevation, cruise baseline | next |
| M2 | Contact solver and provenance drawer | |
| M3 | Plan view and live sliders | |
| M4 | Scripted playback | |
| M5 | Vibration overlay | |
| M6 | 3D toggle | gated, may be cut |

M0 deliberately has no interface. A wrong number rendered beautifully is more dangerous than a
right number rendered plainly, because the polish buys it credibility it hasn't earned.

## Running M0

```bash
make test-loadpath      # 57 unit tests
make loadpath-report    # the headless model report
```

The report takes two options:

```bash
node apps/loadpath/js/m0-report.js --surface wet --driver f05
```

`--surface` is `dry`, `wet` or `snow`. `--driver` is `m50`, `f05` or `m95`. It exits non-zero if
the Newton's third law audit fails.

Abridged output:

```
  VEHICLE STATE
  Scenario              km/h   ax (g)   ay (g)   friction  radius    status
  Brisk left bend          79      0.00     0.51       56%  98 m      ok
  Trail braking in         79     -0.41     0.51       72%  98 m      ok
  Panic stop               90     -0.90     0.00      102%  straight  TRACTION EXCEEDED

  FORCES ON AND FROM THE DRIVER (78 kg)
  Scenario              g-load   car->body (N)              body->car (N)
  Brisk left bend         1.12   (     0,   387,   765 )    (     0,  -387,  -765 )
  Trail braking in        1.19   (  -312,   387,   765 )    (   312,  -387,  -765 )

  NEWTON THIRD LAW AUDIT — the gate for this milestone
  Worst residual across 10 scenarios: 2.542e-13 N  (Panic stop)
  Verdict: PASS
```

The report ends by printing every constant that is not yet fully sourced, so the weak numbers
are visible every time you run it rather than buried in a table.

## Layout

```
apps/loadpath/
├── PLAN.html            the build plan, start here
├── README.md
├── LEARNING.md          how the plan was reasoned out, and what to avoid
├── js/model/
│   ├── constants.js     values plus a provenance record for each
│   ├── vehicle.js       EQ 1-4: cornering, load transfer, friction ellipse
│   └── occupant.js      EQ 5-6: segment masses, required force, third-law audit
├── js/m0-report.js      headless harness; goes away when app.js arrives
└── images/              four generated illustrations

tests/loadpath/model.test.js    at the repo root, matching gridprobe and mindmap
```

## Attribution

Prepared by David Berkowitz. Research and drafting with Anthropic Claude. Illustrations
generated with Google Gemini Nano Banana Pro (`gemini-3-pro-image-preview`); every prompt is
preserved in full in section 09 of the plan.
