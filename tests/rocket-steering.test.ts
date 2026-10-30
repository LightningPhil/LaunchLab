import test from 'node:test';
import assert from 'node:assert/strict';
import { RocketPhysics as P, type RocketConfig } from '../src/rocket_physics.ts';
import { EARTH_STEERING_PRACTICE, EARTH_ORBIT_EXAMPLE, ROCKET_DEFAULTS } from '../src/launch-settings.ts';
import { resolveEnvironment, classifyTrajectory } from '../src/environment.ts';
import { recordFlight, sampleFlight } from '../src/flight.ts';
import { steeringAttemptFeedback } from '../src/orbit-feedback.ts';

function practice(overrides: Partial<RocketConfig> = {}) {
  const environment = resolveEnvironment(9.81);
  return { ...EARTH_STEERING_PRACTICE, ...overrides, gravity: 9.81, environment, planetRadius: environment.radius };
}

test('manual cutoff splits a timestep exactly and conserves propellant and rocket impulse', () => {
  const c: RocketConfig = { ...ROCKET_DEFAULTS, Pa_Pa: 0, launchAngle: 90, cutoffTime: .137 };
  const initial = P.createRocketState(c), guidance = P.buildGuidance(c);
  const after = P.stepRocket(initial, .5, 0, guidance);
  const fuel = initial.mProp - initial.mdot * c.cutoffTime!;
  const speed = initial.thrustMagnitude / initial.mdot * Math.log(initial.mass / (initial.mDry + fuel));
  assert.equal(after.cutoffReason, 'planned');
  assert.ok(Math.abs(after.burnoutTime! - .137) < 1e-10);
  assert.ok(Math.abs(after.mProp - fuel) < 1e-9);
  assert.ok(Math.abs(after.vy - speed) < 1e-8);
  assert.ok(Math.abs(after.totalImpulse - initial.thrustMagnitude * .137) < 1e-8);
  assert.equal(after.engineOn, false);
  assert.equal(after.thrustMagnitude, 0);
  const coast = P.stepRocket(after, 10, 0, guidance);
  assert.equal(coast.mProp, after.mProp);
  assert.equal(coast.totalImpulse, after.totalImpulse);
  assert.equal(coast.vy, after.vy);
});

test('timer never replaces orbit assist or manufactures fuel when the tank empties first', () => {
  const assisted = P.buildGuidance({ ...EARTH_ORBIT_EXAMPLE, cutoffTime: 1 });
  assert.equal(assisted.getThrottle instanceof Function, true);
  assert.equal(assisted.cutoffReason, undefined);
  for (const cutoffTime of [undefined, 0, -1, NaN, Infinity, 600]) {
    const c: RocketConfig = { ...ROCKET_DEFAULTS, launchAngle: 90, Pa_Pa: 0, cutoffTime };
    const initial = P.createRocketState(c);
    const final = P.stepRocket(initial, 20, 0, P.buildGuidance(c));
    assert.equal(final.cutoffReason, 'empty');
    assert.equal(final.mProp, 0);
    assert.ok(Math.abs(final.burnoutTime! - initial.mProp / initial.mdot) < 1e-8);
  }
});

test('manual practice reaches an unpowered orbit, preserves fuel, and replays cutoff continuously', async () => {
  const c = practice(), guidance = P.buildGuidance(c);
  assert.equal(guidance.getThrottle, undefined, 'No adaptive throttle');
  const initial = P.createRocketState(c);
  assert.equal(guidance.getAngle({ ...initial, time: 55, y: 1000, vx: 0 }), 40);
  assert.equal(guidance.getAngle({ ...initial, time: 55, y: 400000, vx: 9000 }), 40,
    'Commands depend on the clock, not a hidden orbit target');
  const run = await recordFlight('rocket', c, initial);
  assert.equal(run.outcome, 'orbit');
  assert.ok(run.orbit);
  assert.ok(run.orbit.periapsisAltitude > 95000 && run.orbit.periapsisAltitude < 105000);
  assert.ok(run.orbit.apoapsisAltitude > 180000 && run.orbit.apoapsisAltitude < 210000);
  const before = sampleFlight(run, c.cutoffTime! - .001);
  const at = sampleFlight(run, c.cutoffTime!);
  const after = sampleFlight(run, c.cutoffTime! + .001);
  assert.equal(before.engineOn, true);
  assert.equal(at.engineOn, false);
  assert.equal(at.cutoffReason, 'planned');
  assert.ok(at.mProp > 0);
  assert.equal(after.mProp, at.mProp);
  assert.ok(Math.hypot(after.wx - before.wx, after.wy - before.wy) < 20);
  assert.match(steeringAttemptFeedback(run)!, /Your plan made an orbit/);
  assert.match(steeringAttemptFeedback(run)!, /sideways/);
  for (const dt of [1 / 60, 1 / 120]) {
    let state = initial;
    while (state.engineOn && state.time < 140) state = P.stepRocket(state, dt, c.gravity, guidance);
    const orbit = classifyTrajectory(state, c.gravity);
    assert.equal(orbit.kind, 'orbit');
    assert.ok(Math.abs(orbit.apoapsisAltitude! - run.orbit.apoapsisAltitude) < 10);
  }
});

test('manual changes genuinely change the result: early cutoff falls back, full burn escapes', async () => {
  for (const [cutoffTime, outcome, advice] of [[136.3, 'impact', /0.5 s later/], [0, 'escape', /earlier cutoff/]] as const) {
    const c = practice({ cutoffTime });
    const run = await recordFlight('rocket', c, P.createRocketState(c));
    assert.equal(run.outcome, outcome);
    assert.match(steeringAttemptFeedback(run)!, advice);
  }
  const c = practice({ ...ROCKET_DEFAULTS, guidanceMode: 'pitch_program', cutoffTime: 137.3 });
  const run = await recordFlight('rocket', c, P.createRocketState(c));
  assert.equal(run.outcome, 'impact', 'A practice timer cannot rescue an inadequate rocket');
  assert.equal(run.orbit, undefined);
});
