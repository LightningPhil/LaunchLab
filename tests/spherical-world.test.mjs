import test from 'node:test';
import assert from 'node:assert/strict';
import { ENVIRONMENTS } from '../src/environment.ts';
import { Physics } from '../src/physics.ts';
import { RocketPhysics } from '../src/rocket_physics.ts';
import { surfacePosition, radialGravity, gravityAtAltitude, worldViewFrame } from '../src/spherical-world.ts';

const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} differs from ${expected} by more than ${tolerance}`);

test('every world projects onto its physical radius, including the far side and multiple revolutions', () => {
  for (const { radius } of ENVIRONMENTS) for (const angle of [-7, -Math.PI, -.4, 0, .4, Math.PI, 7]) {
    for (const altitude of [0, .01, radius * .1]) {
      const point = surfacePosition(radius * angle, altitude, radius);
      near(Math.hypot(point.x, point.y + radius), radius + altitude, radius * 1e-14);
    }
    // Curvature is tiny at a human scale, without losing centimetre altitudes.
    near(surfacePosition(0, .01, radius).y, .01, 1e-14);
    near(surfacePosition(1, 0, radius).y, -1 / (2 * radius), 1e-16);
  }
});

test('gravity is inward at every longitude and falls by the square of centre distance on all worlds', () => {
  for (const { radius, gravity } of ENVIRONMENTS) for (const angle of [0, .4, Math.PI / 2, Math.PI, -2]) {
    for (const multiple of [1, 1.5, 2, 10]) {
      const x = radius * multiple * Math.sin(angle), y = radius * multiple * Math.cos(angle);
      const a = radialGravity(x, y, radius, gravity);
      near(Math.hypot(a.x, a.y), gravity / multiple ** 2, 1e-10);
      near(a.x * Math.cos(angle) - a.y * Math.sin(angle), 0, 1e-10);
      assert.ok(a.x * x + a.y * y < 0);
      near(gravityAtAltitude(radius, gravity, radius * (multiple - 1)), gravity / multiple ** 2, 1e-10);
    }
  }
});

test('both solvers freely fall toward the same centre, including the side and underside of each world', () => {
  for (const environment of ENVIRONMENTS) for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const { radius, gravity } = environment;
    const ball = Physics.createProjectile(radius * angle, radius, 0, 0, 100, radius);
    const rocket = { ...RocketPhysics.createRocketState({ environment, planetRadius: radius,
      propellantId: 'LOX_RP1', MR: 2.56, Pc_bar: 100, epsilon: 20, throatDia_mm: 15,
      dryMass: 100, propMass: 0, launchAngle: 90, guidanceMode: 'fixed' }), ...ball,
      engineOn: false, launched: true };
    const nextBall = Physics.stepProjectile(ball, .01, gravity);
    const nextRocket = RocketPhysics.stepRocket(rocket, .01, gravity);
    near(nextBall.vy, -gravity / 4 * .01, 1e-8);
    near(nextBall.vx, 0);
    near(nextRocket.wx, nextBall.wx, radius * 1e-14);
    near(nextRocket.wy, nextBall.wy, radius * 1e-14);
    near(nextRocket.wvx, nextBall.wvx); near(nextRocket.wvy, nextBall.wvy);
  }
});

test('world and horizon frames keep distant flights visible without stretching the sphere', () => {
  for (const { radius } of ENVIRONMENTS) for (const [width, height] of [[960, 540], [320, 300], [640, 180]]) {
    for (const mode of ['world', 'horizon']) for (const focus of [
      { x: 0, y: 0 }, { x: radius * 2, y: radius * .6 }, { x: radius * 4, y: radius * 20 }]) {
      const frame = worldViewFrame(mode, radius, width, height, focus, 0);
      const visible = point => {
        const p = surfacePosition(point.x, point.y, radius);
        const x = frame.originX + p.x * frame.ppm, y = frame.originY - p.y * frame.ppm;
        assert.ok(x >= 23 && x <= width - 23 && y >= 23 && y <= height - 23, `${mode} at ${width}×${height}: ${x}, ${y}`);
      };
      visible(focus); visible({ x: 0, y: 0 });
      if (mode === 'world') for (let a = 0; a < 2 * Math.PI; a += Math.PI / 12) visible({ x: a * radius, y: 0 });
      assert.ok(Number.isFinite(frame.ppm) && frame.ppm > 0);
    }
  }
});

test('cannon contact on a small moon meets the round surface below the launch tangent', () => {
  const radius = 10000, gravity = .62;
  let state = Physics.createProjectile(0, 2, 50, 30, 1, radius);
  for (let i = 0; i < 100000 && state.outcome !== 'impact'; i++) state = Physics.stepProjectile(state, 1 / 120, gravity);
  assert.equal(state.outcome, 'impact');
  near(Math.hypot(state.wx, state.wy), radius, 1e-8);
  const ground = surfacePosition(state.x, 0, radius);
  assert.ok(ground.y < -100, 'Contact is below the original flat tangent');
  near(ground.x, state.wx); near(ground.y + radius, state.wy);
});
