import assert from 'node:assert/strict';
import test from 'node:test';
import { localHorizon, horizonPoint, traceLocalDisc } from '../src/local-horizon.ts';

test('local circle paths remain subpixel accurate on every hemisphere and zoom', () => {
  for (const [width, height] of [[320, 568], [960, 540], [2413, 1278]]) {
    for (const radius of [17 * (Math.hypot(width, height) + 32), 6371000 * 80, 69911000 * 800]) {
      for (const angle of [0, .4, Math.PI / 2, 2.9, Math.PI, 4.5, 6]) {
        const h = localHorizon(width / 2 - Math.sin(angle) * radius,
          height / 2 + Math.cos(angle) * radius, radius, width, height);
        for (const depth of [0, 8, 40]) {
          let start;
          const context = {
            moveTo(x, y) { start = { x, y }; },
            quadraticCurveTo(cx, cy, x, y) {
              for (const t of [.25, .5, .75]) {
                const p = { x: (1-t)**2 * start.x + 2*(1-t)*t*cx + t*t*x,
                  y: (1-t)**2 * start.y + 2*(1-t)*t*cy + t*t*y };
                const along = -(p.x - h.surface.x) * h.normal.y + (p.y - h.surface.y) * h.normal.x;
                const exact = horizonPoint(h, along, depth);
                assert.ok(Math.hypot(p.x - exact.x, p.y - exact.y) < .0001,
                  'Curve error stays below 1/10,000 CSS pixel');
              }
              start = { x, y };
            },
            lineTo() {}, closePath() {},
          };
          traceLocalDisc(context, h, depth);
        }
      }
    }
  }
});

test('offscreen circles fill or omit the entire viewport without giant path coordinates', () => {
  const radius = 6371000 * 800;
  for (const direction of [-1, 1]) {
    const h = localHorizon(480, 270 + radius + direction * 1000, radius, 960, 540);
    const rectangles = [];
    traceLocalDisc({ rect: (...args) => rectangles.push(args) }, h);
    assert.deepEqual(rectangles, direction < 0 ? [[0, 0, 960, 540]] : []);
  }
});
