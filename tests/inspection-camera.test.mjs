import test from 'node:test';
import assert from 'node:assert/strict';
import { InspectionCamera } from '../src/inspection-camera.ts';
import { Renderer } from '../src/renderer.ts';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} differs from ${b}`);
const worldAt = (view, point) => ({ x: (point.x - view.originX) / view.ppm, y: (view.originY - point.y) / view.ppm });

test('manual entry freezes the exact camera; wheel and pinch preserve their world anchor', () => {
  const camera = new InspectionCamera(), original = { ppm: .003, originX: 150, originY: 280 };
  camera.start(original, 960, 540); assert.deepEqual(camera.view, original);
  const from = { x: 237, y: 171 }, to = { x: 312, y: 223 }, world = worldAt(camera.view, from);
  camera.zoom(2, from, to);
  const after = worldAt(camera.view, to); near(after.x, world.x); near(after.y, world.y);
  camera.zoom(.5, to, from); assert.deepEqual(camera.view, original);
  for (const factor of [1e30, 1e-60]) {
    const point = worldAt(camera.view, from); camera.zoom(factor, from);
    const actual = worldAt(camera.view, from); near(actual.x, point.x); near(actual.y, point.y);
    assert.ok(camera.view.ppm >= 1e-8 && camera.view.ppm <= 800);
  }
});

test('panning, site centring and resizing keep the inspected location stable', () => {
  const camera = new InspectionCamera(); camera.start({ ppm: 2, originX: 100, originY: 300 }, 960, 540);
  const site = { x: 720, y: 420 }, world = worldAt(camera.view, site);
  camera.centre(site);
  const middle = { x: 480, y: 270 }; assert.deepEqual(worldAt(camera.view, middle), world);
  camera.zoom(10, middle); assert.deepEqual(worldAt(camera.view, middle), world);
  camera.resize(390, 600); assert.deepEqual(worldAt(camera.view, { x: 195, y: 300 }), world);
  camera.pan(70, -40); assert.deepEqual(worldAt(camera.view, { x: 265, y: 260 }), world);
});

test('automatic flight requests cannot move a manual view, including seeks and changed zoom targets', () => {
  const gradient = { addColorStop() {} };
  const context = new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (obj, key) => obj[key] || (() => {}) });
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.ResizeObserver = class { observe() {} };
  Renderer.init({ getContext: () => context, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
  Renderer.resetCamera(); Renderer.setTargetGravity(1.62); Renderer.setZoomImmediate(.0001); Renderer.updateWorld(0);
  const before = Renderer.toCanvas(1737400 * .2, 0);
  Renderer.setManualZoom(true);
  Renderer.setRocketCamera({ state: { x: 1000000, y: 4000000 }, ahead: [], launchX: 1.5, radius: 1737400, epsilon: 20, margin: .15 });
  Renderer.setTargetZoom(80); Renderer.updateWorld(10);
  assert.deepEqual(Renderer.toCanvas(1737400 * .2, 0), before);
  Renderer.panView(50, 25); Renderer.updateWorld(0);
  const panned = Renderer.toCanvas(1737400 * .2, 0); near(panned.x, before.x + 50); near(panned.y, before.y + 25);
  Renderer.setManualZoom(false); Renderer.updateWorld(10);
  assert.notDeepEqual(Renderer.toCanvas(1737400 * .2, 0), panned, 'Auto resumes tracking');
  Renderer.setManualZoom(true); Renderer.resetCamera(); assert.equal(Renderer.isManualZoom(), false, 'Reset starts back in Auto');
});
