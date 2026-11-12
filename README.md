# ORBITAL: Beyond the Mission

An interactive space-mission design and operations game for the NASA Space Apps Challenge.
Design a spacecraft, choose its rocket and trajectory, pass a readiness review, launch it, fly it through
anomalies from mission control, and get a scored mission report.

> Independent educational project. Not affiliated with or endorsed by NASA. The agency (OXD), missions,
> hardware, rockets, costs and discoveries are fictional; physics constants and validation cases are real.

## Run it

It's plain HTML/CSS/JS with no build step and no dependencies. Serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly also works in most browsers.

### Demo shortcuts (for judging)
- `?demo=mars` starts a mission at its briefing, with all missions unlocked. Missions: `eo, moon, mars, asteroid, jupiter, kbo`.
- `?demo=mars&screen=design` jumps straight to the Design Studio.
- `?demo=jupiter&days=1800` launches the draft design and fast-forwards 1,800 days into Mission Control.
- `?demo=moon&days=400&screen=report` produces a finished mission report.
- On the Missions screen, **Unlock all missions** and **Realistic launch failures** are toggles.

## Architecture
| File | Role |
|---|---|
| `js/data.js` | Catalog: real body constants, fictional components/instruments/launchers, missions, glossary, references |
| `js/physics.js` | Patched conics, Kepler solver, rocket equation, Edelbaum, numerical integrator with Jupiter flyby, link budget, thermal balance |
| `js/engine.js` | `evaluate(mission, design)`: mass, power, thermal, comms, Δv, launch, cost, reliability, radiation, science, issues, readiness |
| `js/sim.js`, `js/events.js` | Time-stepped mission simulator, hazard-driven anomalies, light-time-delayed commands, decisions, discoveries |
| `js/screens/*` | Landing, missions, briefing, design studio, payload, launcher, trajectory, review, launch, mission control, report, library |

The design studio, simulator and report all use the same engine. The Library → Validation tab shows the model
reproducing real figures, e.g. a 259-day Hohmann transfer to Mars, Juno-like Jupiter orbit insertion ≈ 0.54 km/s,
and a New Horizons-like trajectory reaching Jupiter in about 1.1 yr.
