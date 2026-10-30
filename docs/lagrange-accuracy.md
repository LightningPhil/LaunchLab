# Lagrange numerical audit

Audited 19 October 2026. This validates the **planar circular restricted three-body model** used in the wiki, rather than claiming ephemeris or spacecraft-navigation accuracy for the real Solar System.

## Units and the quantity shown

Let separation be d, total gravitational parameter be GM, and μ be the companion's fraction of total GM. Length unit is d, time unit is √(d³/GM), and speed unit is √(GM/d), the pair's relative circular orbital speed. One pair orbit is 2π time units. The primary and companion have rotating coordinates (−μ, 0) and (1−μ, 0).

For selected equilibrium (xL, yL), the starting state is:

```
x = xL + offsetPercent / 100
y = yL
vx = 0
vy = kickPercent / 100
```

The initial kick is relative to the **rotating frame**. With zero kick, the inertial velocity already contains corotation Ω×r. The orbit camera applies R(t) to each position at that position's own time.

```
departurePercent = 100 × hypot(x − xL, y − yL)
closeupXkm = d × (x − xL)
closeupYkm = d × (y − yL)
```

These definitions include the initial offset. In Earth–Moon, 0.1% is 384.4 km. Both close-up axes use identical pixels per kilometre. “Error” in the departure chart means displacement from the equilibrium, independently of numerical error in solving the equations.

## Equations and integration

With r₁ = hypot(x+μ,y) and r₂ = hypot(x−1+μ,y), the acceleration is:

```
ax = x − (1−μ)(x+μ)/r₁³ − μ(x−1+μ)/r₂³ + 2vy
ay = y − (1−μ)y/r₁³ − μy/r₂³ − 2vx
C  = x²+y² + 2(1−μ)/r₁ + 2μ/r₂ − vx²−vy²
```

The test suite independently transforms this acceleration back to the inertial frame and checks it against the sum of the two Newtonian gravitational forces. This tests the centrifugal term, both Coriolis signs and the coordinate convention. Equilibrium coordinates also retain the independent JPL checks described in [gravity and optics](gravity-and-optics.md). A reference for the equations and units is the [AGI/Purdue CR3BP implementation paper](https://help.agi.com/stk/LinkedDocuments/CR3BPTechPaper.pdf).

The production integrator uses DOP853, order 8, with its order-7 continuous extension. Every trial step controls errors in all four position/velocity components. Relative tolerance is 10⁻¹³, absolute tolerance 10⁻¹⁵, and maximum normalized step 0.1. Local gravity/travel limits shorten the step near a world. Rejected steps never advance the solution. Dense root finding locates contact and the observation-region boundary; there is no forced minimum step that could overrun an event.

Internally, positions are stored relative to the nearer world. The reference origin changes with hysteresis when the probe approaches the other world. This avoids repeatedly subtracting nearly equal barycentric coordinates during small-world encounters, preserving precision in a system such as Sun–Pluto. Every recorded continuous segment retains its origin; replay reconstructs its barycentric position consistently.

Replay evaluates the continuous solution at the requested instant, including velocity. Adaptive drawing vertices and dense midpoints replace uniform sparse samples and every-third-point decimation. Distance maxima are refined at roots of (x−xL)vx + (y−yL)vy, preventing missed peaks in the “largest predicted departure” value. A zero-offset, zero-kick release uses the exact analytic equilibrium solution, avoiding amplification of the last floating-point root residual.

Coefficients and the numerical scheme are adapted from SciPy, with its BSD notice in `THIRD_PARTY_NOTICES.txt` and the packaged manual. The [SciPy solver documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html) describes DOP853 and its continuous extension. No SciPy or Python runtime is needed by the application.

## Sensitive trajectories

Jacobi conservation is monitored, but is not sufficient to establish trajectory accuracy; see [Espresate and Castro's numerical examples](https://arxiv.org/abs/astro-ph/0303337). Every nontrivial production run is compared against a second run with relative tolerance 2.3×10⁻¹⁴, absolute tolerance 2×10⁻¹⁶ and maximum step 0.05. The integrations choose their own adaptive steps.

At the adaptive drawing times, their position difference must remain within the smaller of 10⁻⁸ separations and 10 m, with a floor of 10⁻¹² separations. The two integrations advance together, so an unverified future is not calculated and then discarded. If the threshold is exceeded, the crossing is refined and the forecast ends there. The UI explains an early numerical agreement limit. It never presents a diverged numerical tail as a confidently predicted spacecraft path. The reported disagreement is a convergence diagnostic, **not a rigorous global error bound**, and does not include errors from the circular model, initial conditions or physical parameters.

## Independent verification

`tests/fixtures/lagrange-probes.json` contains independently propagated trajectories for every real pair and L1–L5, plus longer stable/unstable runs, close encounters, positive/negative kicks and fictional mass ratios around the triangular stability boundary. SciPy uses an independently written gravitational right-hand side and a refined maximum step; representative early trajectories also use the different implicit Radau algorithm. Frozen initial binary64 states distinguish propagation error from differing equilibrium-root rounding. Off-grid checkpoints specifically exercise replay interpolation.

Regenerate with Python, NumPy and SciPy available:

```
python tools/generate-lagrange-reference.py
node --test tests/lagrange-accuracy.test.mjs
```

Normal project tests use the checked-in numbers and require only Node. Checks also cover exact initial units, the analytic unperturbed equilibrium over twelve orbits, continuous-output oscillator accuracy, physical surface contact, independently located departure maxima, bounded finite execution, and stopping a long sensitive forecast at its numerical agreement limit.

For the 71 reference cases, the largest observed position difference at the tested timestamps within the displayed prediction was **2.37 m** (Sun–Neptune L1). The six-orbit Earth–Moon L1 case differed by at most **0.534 m** at those checkpoints; the stricter in-app rerun disagreed by at most **3.04 m** over its adaptive verification points. These are measured comparisons for specified cases and timestamps, not a universal error guarantee. Reference refinement differences are recorded individually in the fixture. The old linear interpolation and fixed-accuracy RK4 solution fail these comparisons by large margins, especially during close encounters.

A further 240 experiments exercised all twelve pairs, all five points, both offset endpoints (0.02% and 2%), both kick endpoints (−0.5% and +0.5%) and a requested twelve-orbit duration. All remained finite and ended by a duration, surface, region or numerical agreement condition; none exhausted the integration limit. Some sensitive cases correctly stop before twelve orbits.
