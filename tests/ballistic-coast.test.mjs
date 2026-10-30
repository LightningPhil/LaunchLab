import test from 'node:test';
import assert from 'node:assert/strict';
import { planBallisticCoast, sampleBallisticCoast, ESCAPE_CENTRE_RADII } from '../src/ballistic-coast.ts';
import { recordFlight, sampleFlight, PHYSICS_STEP } from '../src/flight.ts';
import { Physics } from '../src/physics.ts';
import { RocketPhysics } from '../src/rocket_physics.ts';
import { resolveEnvironment, classifyTrajectory, pressureAtAltitude } from '../src/environment.ts';
import { formatTime } from '../src/number-format.ts';

const environment = resolveEnvironment(9.81), R = environment.radius, g = environment.gravity, mu = g * R * R;
const config = { gravity: g, planetRadius: R, environment };
const initial = (factor, angle = 45) => Physics.createProjectile(0, 5, Math.sqrt(2 * mu / (R + 5)) * factor, angle, 1, R);

test('near-escape Earth launches return through exact contact even after months or years', async () => {
  for (const factor of [.999, .9999]) {
    const start = initial(factor), run = await recordFlight('cannon', config, start);
    assert.equal(run.outcome, 'impact');
    assert.ok(run.duration > 200 * 86400);
    assert.ok(run.samples.length < 3000, 'Recording size does not grow with the orbital period');
    const apex = run.events.find(event => event.kind === 'apex');
    assert.ok(apex && apex.time < run.duration);
    assert.equal(sampleFlight(run, apex.time).vy, 0);
    assert.ok(Math.abs(sampleFlight(run, apex.time).y - run.maxHeight) < .0001);
    const initialEnergy = classifyTrajectory(start, g).specificEnergy;
    const initialMomentum = start.wx * start.wvy - start.wy * start.wvx;
    for (const time of [.123, run.duration * .1, apex.time, run.duration * .8, run.duration - .1]) {
      const state = sampleFlight(run, time);
      assert.ok(state.y > 0);
      assert.equal(state.outcome, 'flight');
      assert.ok(Math.abs(classifyTrajectory(state, g).specificEnergy - initialEnergy) < 1e-5);
      assert.ok(Math.abs((state.wx * state.wvy - state.wy * state.wvx) / initialMomentum - 1) < 1e-8);
      assert.ok(Math.abs(Math.hypot(state.wx, state.wy) - (R + state.y)) < 1);
    }
    const incoming = sampleFlight(run, run.duration - .01), impact = sampleFlight(run, run.duration);
    assert.ok(incoming.vy < 0 && incoming.y > 0 && incoming.y < 100);
    assert.equal(impact.y, 0); assert.equal(impact.vy, 0);
    assert.ok(Math.abs(Math.hypot(impact.wx, impact.wy) - R) < 1e-7);
    assert.ok(Math.abs(impact.impactSpeed ** 2 / 2 - mu / R - initialEnergy) < 1e-6);
    assert.ok(!run.events.some(event => event.label === 'Observation limit' || event.kind === 'escape'));
  }
});

test('unpowered coast agrees with fine-step physics for outward, inward, vertical and reversed launches', () => {
  for (const angle of [45, 90, 135, -45]) {
    const start = initial(.999, angle), plan = planBallisticCoast(start, g);
    assert.ok(plan);
    const time = angle < 0 ? plan.endTime / 2 : 30;
    let reference = start;
    while (reference.time + PHYSICS_STEP < time) reference = Physics.stepProjectile(reference, PHYSICS_STEP, g);
    reference = Physics.stepProjectile(reference, time - reference.time, g);
    const exact = sampleBallisticCoast(plan, time);
    for (const key of ['wx', 'wy', 'wvx', 'wvy', 'x', 'y', 'vx', 'vy']) {
      assert.ok(Math.abs(exact[key] - reference[key]) < .002, `${angle}°: ${key}`);
    }
  }
});

test('exactly parabolic radial departure follows the analytical escape law to ten radii', () => {
  const start = Physics.createProjectile(0, 0, 2, 90, 1, 1);
  const plan = planBallisticCoast(start, 2);
  assert.equal(Math.abs(plan.alpha), 0); assert.equal(plan.outcome, 'escape');
  for (const time of [.1, 1, 5]) {
    const state = sampleBallisticCoast(plan, time);
    assert.ok(Math.abs(state.y + 1 - (1 + 3 * time) ** (2 / 3)) < 1e-12);
  }
  assert.ok(Math.abs(plan.endTime - (10 ** 1.5 - 1) / 3) < 1e-12);
  assert.ok(Math.abs(sampleBallisticCoast(plan, plan.endTime).y - 9) < 1e-12);
});

test('just above escape speed stays outgoing and never acquires an invented landing', async () => {
  const run = await recordFlight('cannon', config, initial(1.000001));
  assert.equal(run.outcome, 'escape');
  assert.ok(Math.abs(run.samples.at(-1).y / R - (ESCAPE_CENTRE_RADII - 1)) < 1e-10);
  assert.ok(run.samples.every(state => state.vy > 0 && state.outcome === 'flight'));
  assert.ok(!run.events.some(event => ['apex', 'impact'].includes(event.kind)));
  assert.ok(run.events.some(event => event.kind === 'escape'));
});

test('powered rocket recording joins its exact coast without losing cutoff, mass, pressure or guidance', async () => {
  const settings = { ...config, propellantId: 'LOX_RP1', MR: 2.56, Pc_bar: 300, epsilon: 20,
    throatDia_mm: 200, dryMass: 1, propMass: 5000, launchAngle: 90, etaC: .95, etaN: .95,
    guidanceMode: 'prograde_lock', progradeVmin: 10 };
  const start = RocketPhysics.createRocketState(settings);
  const run = await recordFlight('rocket', settings, start);
  assert.equal(run.outcome, 'escape'); assert.ok(run.coast);
  const cutoff = run.events.find(event => event.kind === 'burnout');
  assert.ok(cutoff && cutoff.time <= run.coast.initial.time);
  const before = sampleFlight(run, cutoff.time - .01), after = sampleFlight(run, run.coast.initial.time + .01);
  assert.equal(before.engineOn, true); assert.ok(before.mProp > 0);
  assert.equal(after.engineOn, false); assert.equal(after.mProp, 0); assert.equal(after.mass, 1);
  assert.equal(after.thrustMagnitude, 0);
  const reference = RocketPhysics.stepRocket(run.coast.initial, .01, g, RocketPhysics.buildGuidance(settings));
  assert.ok(Math.abs(after.wvy - reference.wvy) < 1e-5);
  assert.ok(Math.abs(after.wy - reference.wy) < 1e-5);
  for (const state of [after, sampleFlight(run, run.duration * .5), run.samples.at(-1)]) {
    assert.equal(state.burnoutTime, cutoff.time);
    assert.equal(state.Pa_Pa, pressureAtAltitude(environment, state.y));
    assert.equal(state.theta, Math.atan2(state.vy, state.vx) * 180 / Math.PI);
    assert.equal(state.totalImpulse, run.coast.initial.totalImpulse);
    assert.ok(Math.abs(state.gravityImpulseY - run.coast.initial.gravityImpulseY - (state.wvy - run.coast.initial.wvy)) < 1e-8);
  }
});

test('a long analytical flight still yields to Reset cancellation', async () => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 0);
  try { await assert.rejects(recordFlight('cannon', config, initial(.9999), controller.signal), { name: 'AbortError' }); }
  finally { clearTimeout(timer); }
});

test('flight times remain readable across minutes, hours and days', () => {
  for (const [seconds, text] of [[0, '00:00'], [125.9, '02:05'], [3600, '01:00:00'],
    [21600, '06:00:00'], [86400, '1d 00:00:00'], [231 * 86400 + 3661, '231d 01:01:01']]) {
    assert.equal(formatTime(seconds), text);
  }
});
