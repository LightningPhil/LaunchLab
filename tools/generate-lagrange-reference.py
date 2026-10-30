"""Regenerate independent CR3BP trajectory fixtures (Python + SciPy required).

Run from the repository root. No Python dependency is needed by the app/tests.
The frozen binary64 initial states also used by JS separate propagation error
from small differences in root rounding. Equilibria are checked against JPL in
science-labs.test.mjs. Derivatives below are independently written.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
import scipy
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--inputs", default="tests/fixtures/lagrange-probes.json")
parser.add_argument("--output", default="tests/fixtures/lagrange-probes.json")
parser.add_argument("--checkpoint", help="Optional progress file for a long reference run")
parser.add_argument("--only", help="Regenerate one named case")
args = parser.parse_args()
inputs = json.loads(Path(args.inputs).read_text(encoding="utf-8"))
cases = []
for source in inputs["cases"]:
    if args.only and source["id"] != args.only:
        continue
    options, initial = source["options"], source["initial"]
    mu = options["mu"]
    companion = math.hypot(initial["x"]-1+mu, initial["y"]) < math.hypot(initial["x"]+mu, initial["y"])
    origin = 1-mu if companion else -mu

    def rhs(t, q):
        x, y, vx, vy = q
        a, b = x + (1 if companion else 0), x - (0 if companion else 1)
        r1, r2 = (a*a + y*y)**1.5, (b*b + y*y)**1.5
        return [vx, vy, x + origin - (1-mu)*a/r1 - mu*b/r2 + 2*vy,
                y - (1-mu)*y/r1 - mu*y/r2 - 2*vx]

    def primary(t, q):
        return math.hypot(q[0]+(1 if companion else 0), q[1]) - options["primaryRadius"]

    def secondary(t, q):
        return math.hypot(q[0]-(0 if companion else 1), q[1]) - options["secondaryRadius"]

    def region(t, q):
        return 4 - math.hypot(q[0]+origin, q[1])

    for event in (primary, secondary, region):
        event.terminal, event.direction = True, -1

    y0 = [initial[k] for k in ("x", "y", "vx", "vy")]
    y0[0] -= origin
    finish = options["orbits"] * 2 * math.pi
    def solve(max_step, atol):
        result = solve_ivp(rhs, [0, finish], y0, method="DOP853", rtol=2.3e-14,
                           atol=atol, max_step=max_step, dense_output=True,
                           events=(primary, secondary, region))
        assert result.success, (source["id"], result.message)
        return result

    reference, refined = solve(.01, 2e-16), solve(.005, 1e-16)
    end = min(reference.t[-1], refined.t[-1])
    # Deliberately off the app's old .025 drawing grid, including its midpoints.
    times = [0, .0125, .1234567, .7361, 1.29731, math.pi, 5.3971]
    times += [f*end for f in (.317, .613, .829, .977, 1)]
    checkpoints = []
    for t in sorted(set(t for t in times if t <= end)):
        state, other = refined.sol(t), reference.sol(t)
        state[0] += origin; other[0] += origin
        checkpoints.append({"time": t, "state": state.tolist(),
                            "referenceDisagreement": float(np.linalg.norm(state[:2]-other[:2]))})
    case = {k: source[k] for k in ("id", "options", "initial")}
    case.update(checkpoints=checkpoints, endTime=float(refined.t[-1]),
                end=["primary", "secondary", "left-view"][next(i for i, e in enumerate(refined.t_events) if len(e))] if refined.status == 1 else "complete")
    if source["id"] == "earth-moon-L4-long":
        eqx, eqy = initial["x"]-options["offset"], initial["y"]
        def slope(t):
            x,y,vx,vy = refined.sol(t)
            return (x+origin-eqx)*vx + (y-eqy)*vy
        peaks=[]
        for a,b in zip(refined.t[:-1],refined.t[1:]):
            if slope(a)>0 and slope(b)<0:
                t=brentq(slope,a,b,xtol=5e-14)
                x,y,_,_=refined.sol(t)
                peaks.append({"time":t,"departure":math.hypot(x+origin-eqx,y-eqy)})
        case["departurePeaks"]=peaks
    # A different algorithm also checks early motion in representative systems.
    if source.get("radau"):
        limit = min(2*math.pi, end)
        radau = solve_ivp(rhs, [0, limit], y0, method="Radau", rtol=2.3e-14,
                          atol=1e-16, max_step=.01, dense_output=True)
        assert radau.success
        case["radau"] = []
        for p in checkpoints:
            if p["time"] <= limit:
                state = radau.sol(p["time"]); state[0] += origin
                case["radau"].append({"time":p["time"], "state":state.tolist()})
    cases.append(case)
    if args.checkpoint:
        Path(args.checkpoint).write_text(json.dumps({"cases":cases}),encoding="utf-8")
    print(source["id"], "reference complete", flush=True)

Path(args.output).write_text(json.dumps({
    "provenance": {"generator": "tools/generate-lagrange-reference.py", "scipy": scipy.__version__,
                   "method": "DOP853, rtol 2.3e-14; independent Radau checks where present",
                   "refinement": "max_step 0.01 → 0.005; atol 2e-16 → 1e-16",
                   "units": "separation = 1, angular speed = 1; time in radians (one pair orbit = 2π)",
                   "documentation": "https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html"},
    "cases": cases}, indent=2) + "\n", encoding="utf-8")
