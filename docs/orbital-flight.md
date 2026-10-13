# Rocket orbital flight

Use **Rocket → Try an Earth orbit**, then **Lift off**. This sets Earth, LOX/LH2, 100 kg empty mass, 5,000 kg propellant, 100 bar chamber pressure, a 100 mm throat, expansion ratio 20 and 95% efficiencies. Orbit assist targets 200 km. It reaches approximately 198–204 km after about 345 simulated seconds, retaining roughly 321 kg of propellant; the orbital period is about 88 minutes. The same engine on the Moon with a 50 km target also reaches orbit. These are model demonstrations, not real vehicle designs.

## Powered ascent

`guidanceOrbit` in `src/rocket_physics.ts` is a deterministic feedback controller. It starts upright, controls radial velocity toward the target altitude and allocates the available remaining acceleration to reaching circular tangential speed. It can throttle and steer but cannot add velocity, mass or fuel directly. Throttle is an ideal duty cycle that scales engine thrust and propellant flow together, retaining the model's exhaust velocity. Actual engine minimum-throttle, response, structural and attitude-control limits are not simulated.

The controller shuts down when both predicted apsides are within 2% of the target altitude and the bound path clears the world. Cutoff is refined within the physical step, and remaining fuel/mass are retained. An insufficient design can exhaust its fuel, hit the surface or fail to lift off. The original fixed-angle, timed-pitch and velocity-following choices still work. This release automates a continuous ascent burn; manual engine restarts and live piloting are future extensions.

The always-visible **Steer your rocket** section at the top of Rocket setup exposes the steering selector and **Try an Earth orbit** button. Each plan explains how it steers; its relevant settings appear immediately. The example selects Earth and a suitable rocket, confirms that Orbit assist is selected, and directs the user to Lift off. It never launches automatically. Steering is planned before launch; live piloting is not implemented.

The sidebar's lowest/highest point values describe the trajectory **if the engine stopped now** while powered. After cutoff they describe the unpowered trajectory. Surface-intersecting paths say **Meets the surface** instead of displaying a fictional underground destination. Grounded rockets hide this path readout. The common classifier confirms an orbit only for negative specific energy and a periapsis more than one metre above the reference surface. Cannon behaviour is unchanged.

An assisted attempt that lands has a visible result explaining whether it ran out of fuel, its maximum altitude, and how to try again. More fuel is explicitly described as more weight, rather than a guaranteed fix.

## Coast, recording and playback

`src/orbital-coast.ts` handles unpowered, surface-clearing elliptic motion in the existing 2D flight plane. It solves Kepler's equation with bracketed Newton iteration, has a well-defined axis for circular orbits, retains near-periapsis precision with a sagitta expression, and unwraps longitude through multiple revolutions in either direction. The powered solver joins this coast without teleporting or changing energy/fuel. Existing ballistic return and escape solvers are unchanged.

Flight records include one complete orbital period after insertion, sampled uniformly in eccentric anomaly to resolve the fast periapsis passage. Pause, scrubbing and playback evaluate the same canonical orbit. **Continue orbiting** extends the observation time; it retains one geometric circuit and bounded event/sample data rather than accumulating repeated traces. A complete first orbit receives about 20 real viewing seconds: eight for ascent and twelve for the coast. Later circuits take twelve more in Auto; fixed-speed choices retain their actual multipliers.

Once insertion is reached, Auto camera framing includes the whole ellipse so it remains stable as the rocket returns to the launch side. Manual camera inspection still works independently. There is no landing marker for an orbital flight. The compact result card offers **Continue orbiting** and **Inspect orbit** (paused, with Manual zoom). Period, retained fuel and model limitations are available under **Orbit details**. Playback controls still offer replay.

Reset, loading another example, or editing a completed experiment returns to **Ready to launch**. The old recording remains explicitly available as **Replay previous**, which restores its original settings. Resume and timeline inspection are disabled in this setup state, preventing the previous flight from appearing under edited labels. Next moment exposes the destination event and time in its tooltip.

## Model and verification

Worlds are non-rotating spheres with inverse-square central gravity. There is no air drag, terrain, oblateness or pull from other bodies. Surface-clearing orbits therefore persist indefinitely in this model, even where real atmospheres would cause decay. Gas worlds retain their fictional reference-level platform.

Regression tests cover circular/eccentric/retrograde motion on all worlds for 100 revolutions, conservation of energy and angular momentum, closure and longitude continuity, agreement with the numerical solver, real Earth/Moon powered insertion, fuel-retaining cutoff, inadequate designs, replay through insertion, Auto timing and bounded continued observation. Existing landing and escape tests remain required.

The underlying circular-speed and period relationships are described in [NASA Glenn's Flight to Orbit](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/flight-to-orbit/); ellipse shape and apsides are covered in [NASA's Gravity & Mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-4/).
