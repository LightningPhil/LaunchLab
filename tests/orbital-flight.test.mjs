import test from 'node:test';
import assert from 'node:assert/strict';
import { planOrbitalCoast, sampleOrbitalCoast, orbitalSampleTimes } from '../src/orbital-coast.ts';
import { recordFlight, sampleFlight, continueOrbit } from '../src/flight.ts';
import { Physics } from '../src/physics.ts';
import { RocketPhysics } from '../src/rocket_physics.ts';
import { ENVIRONMENTS, resolveEnvironment, classifyTrajectory } from '../src/environment.ts';
import { EARTH_ORBIT_EXAMPLE, ROCKET_DEFAULTS } from '../src/launch-settings.ts';
import { PlaybackClock, automaticRate } from '../src/playback.ts';

function settings(gravity = 9.81, changes = {}) {
  const environment = resolveEnvironment(gravity);
  return { ...EARTH_ORBIT_EXAMPLE, gravity, environment, planetRadius: environment.radius, ...changes };
}

test('circular and eccentric coasts conserve energy and momentum over many revolutions on every world', () => {
  for (const { radius: R, gravity: g } of ENVIRONMENTS) {
    const mu = g * R * R, altitude = .1 * R, r = R + altitude;
    for (const e of [0, .01, .8, .99]) for (const angle of [0, 180]) {
      const initial = Physics.createProjectile(R * 2.9, altitude, Math.sqrt(mu * (1 + e) / r), angle, 100, R);
      const plan = planOrbitalCoast(initial, g);
      assert.ok(plan);
      const energy = classifyTrajectory(initial, g).specificEnergy;
      const momentum = initial.wx * initial.wvy - initial.wy * initial.wvx;
      for (const laps of [.001, .125, .5, .99, 1, 2.4, 100]) {
        const state = sampleOrbitalCoast(plan, initial.time + plan.period * laps);
        const actualEnergy = (state.wvx ** 2 + state.wvy ** 2) / 2 - mu / Math.hypot(state.wx, state.wy);
        assert.ok(Math.abs((actualEnergy - energy) / energy) < 1e-9, 'No energy drift');
        assert.ok(Math.abs((state.wx * state.wvy - state.wy * state.wvx) / momentum - 1) < 1e-9, 'No momentum drift');
        assert.ok(state.y > 0);
        if (Number.isInteger(laps)) {
          assert.ok(Math.hypot(state.wx - initial.wx, state.wy - initial.wy) / R < 1e-7, 'Closed path');
          assert.ok(Math.abs((state.x - initial.x) / (R * 2 * Math.PI) - (angle === 0 ? laps : -laps)) < 1e-7,
            'Longitude is continuous through repeated wraps, in both directions');
        }
      }
      const times = orbitalSampleTimes(plan);
      assert.ok(times.every((time, i) => i === 0 || time > times[i - 1]));
      assert.ok(Math.abs(times.at(-1) - plan.endTime) < plan.period * 1e-12);
    }
  }
});

test('orbit planning rejects surface-intersecting, escaping and powered trajectories', () => {
  const c = settings(), R = c.planetRadius;
  for (const state of [Physics.createProjectile(0, 100000, 1000, 90, 100, R),
    Physics.createProjectile(0, 100000, 15000, 0, 100, R),
    { ...Physics.createProjectile(0, 100000, 7900, 0, 100, R), engineOn: true }]) {
    assert.equal(planOrbitalCoast(state, c.gravity), null);
  }
});

test('analytical orbits match numerical coasting from arbitrary points, including circular and retrograde paths', () => {
  const c = settings(), R = c.planetRadius;
  for (const angle of [0, 15, -15, 165]) {
    const start = Physics.createProjectile(2.9 * R, .4 * R, 7000, angle, 100, R);
    const plan = planOrbitalCoast(start, c.gravity);
    assert.ok(plan);
    let numerical = start;
    for (let i = 0; i < 1200; i++) numerical = Physics.stepProjectile(numerical, 1 / 120, c.gravity);
    const analytical = sampleOrbitalCoast(plan, numerical.time);
    for (const key of ['wx', 'wy', 'wvx', 'wvy', 'x', 'y']) {
      assert.ok(Math.abs(analytical[key] - numerical[key]) < .005, `${angle}: ${key}`);
    }
  }
});

test('Earth example and lunar orbit assist reach real unpowered orbits with fuel retained', async () => {
  for (const [g, height] of [[9.81, 200], [1.62, 50]]) {
    const c = settings(g, { orbitAltitudeKm: height });
    const run = await recordFlight('rocket', c, RocketPhysics.createRocketState(c));
    assert.equal(run.outcome, 'orbit'); assert.ok(run.orbit);
    const cutoff = run.events.find(event => event.kind === 'burnout');
    assert.ok(run.orbit.initial.time >= cutoff.time && run.orbit.initial.time - cutoff.time <= 1 / 120);
    assert.ok(run.orbit.periapsisAltitude >= height * 1000 * .98 - .0001);
    assert.ok(run.orbit.apoapsisAltitude <= height * 1000 * 1.02 + .0001);
    assert.ok(Math.abs(run.duration - run.orbit.initial.time - run.orbit.period) < 1e-8);
    assert.ok(!run.events.some(event => ['impact', 'escape'].includes(event.kind)));
    const before = sampleFlight(run, cutoff.time - .001), at = sampleFlight(run, cutoff.time), after = sampleFlight(run, cutoff.time + .001);
    assert.equal(before.engineOn, true); assert.equal(at.engineOn, false);
    assert.ok(at.mProp > 0 && at.mProp < c.propMass);
    assert.equal(at.mass, c.dryMass + at.mProp);
    assert.equal(at.mProp, after.mProp);
    assert.ok(Math.abs(before.mass - at.mass) < .01, 'Cutoff does not throw away the remaining propellant');
    assert.ok(Math.hypot(after.wx - before.wx, after.wy - before.wy) < 20, 'No insertion teleport');
    const end = sampleFlight(run, run.duration);
    assert.ok(Math.hypot(end.wx - run.orbit.initial.wx, end.wy - run.orbit.initial.wy) < .001, 'One complete physical circuit');
    assert.equal(end.mProp, at.mProp); assert.equal(end.totalImpulse, at.totalImpulse);
    assert.equal(end.engineOn, false); assert.equal(end.thrustMagnitude, 0);
    for (const fps of [30, 60, 144]) {
      const clock = new PlaybackClock(); clock.load(run);
      let frames = 0;
      while (!clock.paused && frames < fps * 22) { clock.advance(1 / fps, run); frames++; }
      assert.equal(clock.time, run.duration);
      assert.ok(Math.abs(frames / fps - 20) < .1, 'Ascent and first orbit remain a twenty-second experience');
    }
    const originalDuration = run.duration, originalCount = run.samples.length;
    const firstCoast = sampleFlight(run, cutoff.time + run.orbit.period / 3);
    const rate = automaticRate(run, originalDuration);
    for (let lap = 0; lap < 12; lap++) assert.equal(continueOrbit(run), true);
    assert.equal(run.orbitLaps, 13);
    assert.ok(Math.abs(run.duration - originalDuration - 12 * run.orbit.period) < 1e-7);
    assert.ok(run.samples.length <= originalCount + 2, 'Continued circuits do not grow the stored trail');
    assert.deepEqual(sampleFlight(run, cutoff.time + run.orbit.period / 3), firstCoast, 'Earlier replay remains identical');
    assert.equal(automaticRate(run, run.duration), rate);
    assert.ok(Math.hypot(sampleFlight(run, run.duration).wx - end.wx, sampleFlight(run, run.duration).wy - end.wy) < .001);
  }
});

test('orbit assist does not manufacture thrust, fuel or a successful orbit for inadequate designs', async () => {
  const c = settings(9.81, { ...ROCKET_DEFAULTS, guidanceMode: 'orbit_assist', launchAngle: 90 });
  const run = await recordFlight('rocket', c, RocketPhysics.createRocketState(c));
  assert.equal(run.outcome, 'impact'); assert.equal(run.orbit, undefined);
  assert.equal(run.samples.at(-1).mProp, 0);
  assert.equal(continueOrbit(run), false);
  for (const sample of run.samples) {
    assert.ok(sample.mProp >= 0 && sample.mProp <= c.propMass);
    assert.ok(sample.mass >= c.dryMass);
  }
});
