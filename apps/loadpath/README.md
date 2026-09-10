# Driver Load Path

A browser simulation of every force a car and its driver push through each other, at each of
the twelve places where they touch.

**Status: planned, not built.** The full build plan is in [`PLAN.html`](PLAN.html) — open it in
a browser. It carries the physics, the touchpoint register, the architecture, the milestones,
the failure modes, and the source provenance for every default value.

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

## The hard part

The total force on the occupant is determined by Newton's second law. The *split* of that force
across bolster, belt, footrest, knee and wheel is not — the system is statically indeterminate.
The plan resolves it as a stiffness-weighted least-norm problem with unilateral sign constraints,
because foam cannot pull and webbing cannot push. That solver is milestone 2, not milestone 6.

## Layout

```
apps/loadpath/
├── PLAN.html       the build plan, start here
├── README.md
├── LEARNING.md     how the plan was reasoned out, and what to avoid
└── images/         four generated illustrations
```

## Attribution

Prepared by David Berkowitz. Research and drafting with Anthropic Claude. Illustrations
generated with Google Gemini Nano Banana Pro (`gemini-3-pro-image-preview`); every prompt is
preserved in full in section 09 of the plan.
