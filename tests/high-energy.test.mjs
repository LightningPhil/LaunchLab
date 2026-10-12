import test from 'node:test';
import assert from 'node:assert/strict';
import { ENVIRONMENTS, classifyTrajectory } from '../src/environment.ts';
import { Physics } from '../src/physics.ts';
import { recordFlight, sampleFlight, MAX_RECORD_TIME } from '../src/flight.ts';
import { PlaybackClock, MAX_AUTO_VIEW_SECONDS } from '../src/playback.ts';

function launch(environment, force = 5000000) {
  const config = { force, forceMultiplier: 1000, angle: 45, mass: .5, barrelLength: 5,
    gravity: environment.gravity, planetRadius: environment.radius, environment };
  const speed = Physics.computeLaunchVelocity(force, config.mass, config.barrelLength);
  return recordFlight('cannon', config, Physics.createProjectile(0, 5, speed, 45, .5, environment.radius));
}

test('maximum ×1,000 shots on every world remain finite and playable in Auto', async () => {
  const escaping = ['pluto', 'ganymede', 'moon', 'mercury', 'mars'];
  for (const environment of ENVIRONMENTS) {
    const run = await launch(environment), final = run.samples.at(-1);
    const expected = escaping.includes(environment.name) ? 'escape' : environment.name === 'venus' ? 'limit' : 'impact';
    assert.equal(run.outcome, expected, environment.name);
    assert.ok(run.duration > 0 && run.duration <= MAX_RECORD_TIME);
    assert.ok(run.samples.length <= 16010, 'Long flights retain bounded sample storage');
    for (const state of run.samples) {
      assert.ok([state.x, state.y, state.vx, state.vy, state.time].every(Number.isFinite));
      assert.ok(state.y >= -1e-6, 'No projectile passes through the round surface');
    }
    if (expected === 'escape') {
      assert.ok(final.y >= 2 * environment.radius, environment.name);
      assert.equal(classifyTrajectory(final, environment.gravity).kind, 'escape');
      assert.ok(!run.events.some(e => e.kind === 'impact' || e.kind === 'apex'));
      const initialEnergy = classifyTrajectory(run.samples[0], environment.gravity).specificEnergy;
      assert.ok(Math.abs(classifyTrajectory(final, environment.gravity).specificEnergy / initialEnergy - 1) < 1e-7);
    } else if (expected === 'impact') {
      assert.equal(final.y, 0);
      assert.ok(run.events.some(e => e.kind === 'apex'));
    } else {
      assert.equal(run.duration, MAX_RECORD_TIME);
      assert.ok(run.events.some(e => e.kind === 'end' && e.label === 'Observation limit'));
      assert.ok(!run.events.some(e => e.kind === 'impact'));
    }
    const clock = new PlaybackClock(); clock.load(run);
    let wall = 0, peakRate = 0;
    while (!clock.paused && wall <= MAX_AUTO_VIEW_SECONDS + .1) {
      peakRate = Math.max(peakRate, clock.rate);
      clock.advance(1 / 60, run); wall += 1 / 60;
    }
    assert.equal(clock.time, run.duration, `${environment.name}: Auto reaches the recorded endpoint`);
    assert.ok(wall <= MAX_AUTO_VIEW_SECONDS + 1 / 60);
    if (environment.name === 'earth') {
      assert.ok(run.maxHeight > 20000000, 'Nearly escaping Earth reveals the whole world');
      assert.ok(peakRate > 1000, 'Auto is not limited to the manual 64× choices');
    }
    // Pausing and manual inspection remain exact even after a fast Auto run.
    clock.seek(run.duration * .4, run.duration);
    const inspected = sampleFlight(run, clock.time);
    assert.ok(Number.isFinite(inspected.y));
    assert.equal(clock.paused, true);
    clock.select(1); clock.paused = false;
    const before = clock.time; clock.advance(.5, run);
    assert.equal(clock.time, before + .5);
  }
});

test('a near-escape Moon shot ends at the observation cap without inventing a landing', async () => {
  const moon = ENVIRONMENTS.find(e => e.name === 'moon');
  const run = await launch(moon, 280000);
  assert.equal(run.outcome, 'limit');
  assert.equal(run.duration, MAX_RECORD_TIME);
  assert.ok(run.maxHeight > moon.radius * 5);
  assert.ok(!run.events.some(e => e.kind === 'impact'));
  const clock = new PlaybackClock(); clock.load(run); clock.advance(MAX_AUTO_VIEW_SECONDS, run);
  assert.equal(clock.time, run.duration); assert.equal(clock.paused, true);
});

test('a deliberately shortened escape keeps its known outcome and explicit observation limit', async () => {
  const moon = ENVIRONMENTS.find(e => e.name === 'moon');
  const run = await recordFlight('cannon', { gravity: moon.gravity, planetRadius: moon.radius },
    Physics.createProjectile(0, 5, 10000, 45, .5, moon.radius), undefined, { maxTime: 10 });
  assert.equal(run.outcome, 'escape');
  assert.equal(run.duration, 10);
  assert.ok(run.events.some(e => e.kind === 'end' && e.label === 'Observation limit'));
  assert.ok(!run.events.some(e => e.kind === 'impact'));
});
