import assert from 'node:assert/strict';
import test from 'node:test';
import { NozzleRender } from '../src/nozzle_render.ts';

function nozzleLabels(pressure, overrides = {}, panel = false) {
  const labels = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    fillText(text) { labels.push(text); },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    measureText(text) { return { width: String(text).length * 6 }; },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const draw = panel ? (ctx, _w, _h, data) => NozzleRender.drawPanel(ctx, 280, 204, data) : NozzleRender.draw;
  draw(context, 960, 540, {
    epsilon: 20, Pc_bar: 80, throatDia_mm: 15, mdot: 1,
    MR: 2.56, At: .00018, gamma: 1.2, worldTime: 0, Pa_Pa: pressure,
    ...overrides,
  });
  return labels;
}

test('compact nozzle sketch retains the same engine labels and recorded state as the field inset', () => {
  for (const pressure of [0,101325]) {
    for (const output of [0,.25,1]) {
      const data = { output, worldTime: 12, engineLabel: output ? 'Burning · recorded flight' : 'Coasting · engine off' };
      assert.deepEqual(nozzleLabels(pressure,data,true),nozzleLabels(pressure,data));
    }
  }
});

test('nozzle identifies vacuum instead of substituting Earth ambient pressure', () => {
  const vacuum = nozzleLabels(0);
  assert.ok(vacuum.includes('vacuum'));
  assert.ok(!vacuum.includes('over-exp'));
  const atmosphere = nozzleLabels(101325);
  assert.ok(atmosphere.includes('over-exp'));
  assert.ok(!atmosphere.includes('vacuum'));
});

test('missing nozzle pressure retains the sea-level design default', () => {
  assert.deepEqual(nozzleLabels(undefined), nozzleLabels(101325));
});

test('nozzle cutaway identifies separated and unchoked flow', () => {
  const separated = nozzleLabels(101325, { flowRegime: 'separated' });
  assert.ok(separated.includes('separated'));
  assert.ok(!separated.includes('over-exp'));
  const unchoked = nozzleLabels(9.2e6, { flowRegime: 'unchoked', mdot: 0 });
  assert.ok(unchoked.includes('not choked'));
  assert.ok(!unchoked.includes('over-exp'));
});

test('throat diameter visibly resizes the sketch without fitting away the change', () => {
  for (const [width, height] of [[240, 115], [300, 115]]) for (const epsilon of [5, 20, 200]) {
    let previous;
    for (const diameter of [5, 15, 50, 200, 500, 1000, 2000]) {
      const layout = NozzleRender.computeLayout({ throatDia_mm: diameter, epsilon }, width, height);
      if (previous) for (const key of ['throatHalfH', 'chamberHalfH', 'exitHalfH']) {
        assert.ok(layout[key] > previous[key], `${key} must grow at ${diameter} mm, ε=${epsilon}`);
      }
      assert.ok(Math.max(layout.chamberHalfH, layout.exitHalfH) <= height * .42 + 1e-10);
      assert.ok(Math.abs((layout.exitHalfH / layout.throatHalfH) ** 2 - epsilon) < 1e-10);
      assert.equal(layout.throatDiameter, diameter);
      previous = layout;
    }
  }
  assert.ok(nozzleLabels(0, { throatDia_mm: 2000 }).includes('Throat 2,000 mm  ·  Exit 8,944 mm'));
});
