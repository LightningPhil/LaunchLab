import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SurfaceLod, surfaceLevel } from '../src/surface-lod.ts';
import { globeSize, projectGlobeRows } from '../src/globe-projection.ts';
import { WORLD_MAPS } from '../src/world-textures.ts';

const flush = () => new Promise(resolve => setImmediate(resolve));
function cache() {
  const requests = [], disposed = [];
  const surface = new SurfaceLod(3, (level, cancelled) => new Promise((resolve, reject) => {
    requests.push({ level, cancelled, resolve, reject });
  }), resource => disposed.push(resource));
  return { surface, requests, disposed };
}

test('physical diameter selects detail, with hysteresis and native level limits', () => {
  assert.equal(surfaceLevel(90), 0);
  assert.equal(surfaceLevel(90 * 1.5), 1); // Windows 150% scaling
  assert.equal(surfaceLevel(400), 1);
  assert.equal(surfaceLevel(400 * 2), 2); // Retina
  assert.equal(surfaceLevel(500, 2), 2);
  assert.equal(surfaceLevel(380, 2), 1);
  assert.equal(surfaceLevel(80, 1), 1);
  assert.equal(surfaceLevel(60, 1), 0);
  assert.equal(surfaceLevel(0, 2), 0);
  assert.equal(surfaceLevel(800, 0, 2), 1);
  assert.equal(surfaceLevel(800, 0, 1), 0);
});

test('loads small first, keeps it visible during upgrades, and debounces the largest map', async () => {
  const { surface, requests } = cache();
  assert.equal(surface.update(900, 100), undefined);
  assert.deepEqual(requests.map(r => r.level), [0, 1]);
  requests[0].resolve('overview'); await flush();
  assert.equal(surface.update(900, 200), 'overview');
  assert.equal(requests.length, 2);
  requests[1].resolve('detail'); await flush();
  assert.equal(surface.update(900, 400), 'detail');
  assert.deepEqual(requests.map(r => r.level), [0, 1, 2]);
  requests[2].resolve('close-up'); await flush();
  assert.equal(surface.update(900, 500), 'close-up');
  assert.equal(surface.update(10, 600), 'overview');
});

test('zooming out releases unused large resources after the grace period', async () => {
  const { surface, requests, disposed } = cache();
  surface.update(900, 0); surface.update(900, 300);
  for (const r of requests) r.resolve(r.level + 1);
  await flush();
  surface.update(900, 400);
  surface.update(20, 1000);
  assert.deepEqual(disposed, []);
  surface.update(20, 15401);
  assert.deepEqual(disposed, [2, 3]);
  assert.equal(surface.update(20, 16000), 1);
  surface.update(900, 17000);
  assert.deepEqual(requests.map(r => r.level), [0, 1, 2, 1]);
});

test('closing a view cancels pending details and discards late completions', async () => {
  const { surface, requests, disposed } = cache();
  surface.update(900, 0); surface.update(900, 300);
  requests[0].resolve('overview'); await flush();
  surface.releaseDetails();
  assert.equal(requests[1].cancelled(), true);
  assert.equal(requests[2].cancelled(), true);
  requests[2].resolve('obsolete'); await flush();
  assert.deepEqual(disposed, ['obsolete']);
  assert.equal(surface.update(10, 400), 'overview');
  surface.disposeAll();
  assert.deepEqual(disposed, ['obsolete', 'overview']);
});

test('failed high-resolution downloads preserve the overview without a retry loop', async () => {
  const { surface, requests } = cache();
  surface.update(900, 0); surface.update(900, 300);
  requests[0].resolve('overview'); requests[1].reject(new Error('offline')); requests[2].reject(new Error('offline'));
  await flush();
  assert.equal(surface.update(900, 1000), 'overview');
  surface.update(900, 20000);
  assert.equal(requests.length, 3);
});

test('every packaged tier has actual image dimensions, source detail, and local URLs', () => {
  const manifest = JSON.parse(readFileSync(new URL('../tools/world-texture-sources.json', import.meta.url)));
  assert.equal(manifest.length, 13);
  for (const item of manifest) {
    const maps = WORLD_MAPS[item.id];
    assert.deepEqual(maps.map(m => m.width), item.widths);
    assert.ok(maps.length >= 1 && maps.length <= 3);
    for (const map of maps) {
      assert.ok(map.width <= item.nativeSize[0]);
      const data = readFileSync(new URL(map.url));
      assert.equal(data.toString('ascii', 0, 4), 'RIFF');
      assert.equal(data.toString('ascii', 8, 12), 'WEBP');
      const format = data.toString('ascii', 12, 16);
      const width = format === 'VP8X' ? 1 + data.readUIntLE(24, 3) : data.readUInt16LE(26) & 0x3fff;
      const height = format === 'VP8X' ? 1 + data.readUIntLE(27, 3) : data.readUInt16LE(28) & 0x3fff;
      assert.equal(width, map.width, map.url);
      assert.equal(height, map.width / 2, map.url);
    }
  }
  assert.equal(WORLD_MAPS.earth.at(-1).width, 8192);
});

test('surface colours stay north-up, seamless across row chunks and bounded in size', () => {
  assert.equal(globeSize(512), 256);
  assert.equal(globeSize(2048), 1024);
  assert.equal(globeSize(8192), 2048);
  assert.equal(globeSize(1e8), 2048);
  const size = 64, width = 64, height = 64;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    pixels.set([x * 4, y * 4, 128, 255], i);
  }
  const whole = new Uint8ClampedArray(size * size * 4), chunks = new Uint8ClampedArray(whole.length);
  projectGlobeRows(pixels, width, height, whole, size, 0, size, true);
  for (let y = 0; y < size; y += 8) projectGlobeRows(pixels, width, height, chunks, size, y, y + 8, true);
  assert.deepEqual(chunks, whole);
  const pixel = (x, y) => whole.slice((y * size + x) * 4, (y * size + x) * 4 + 4);
  assert.equal(pixel(0, 0)[3], 255, 'corners extend the limb colour for vector clipping');
  assert.equal(pixel(32, 32)[3], 255);
  assert.ok(pixel(32, 8)[1] < pixel(32, 56)[1], 'north is above south');
  assert.ok(pixel(8, 32)[0] < pixel(56, 32)[0], 'longitude is not mirrored');
  assert.ok(Math.abs(pixel(32, 32)[0] - 128) < 5, 'centre longitude stays fixed');
});

test('magnified horizons cannot reveal a baked pixel staircase at any texture level', () => {
  // A tiny, deliberately coarse colour layer reproduces the worst magnification
  // case. Any partial/zero alpha in its footprint would expose pixel-shaped
  // gaps inside the live circle. This must also work before detail maps load.
  const width = 8, height = 8;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(180);
  for (const size of [16, 32, 64, 256]) {
    const output = new Uint8ClampedArray(size * size * 4);
    projectGlobeRows(pixels, width, height, output, size, 0, size, true);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      assert.equal(output[index + 3], 255, `opaque colour at ${x},${y} on ${size}px map`);
      // Limb colour must extend outside the circle, not opaque black/blank
      // padding which would create a different staircase after interpolation.
      assert.ok(output[index] >= 122 && output[index] <= 180);
      assert.equal(output[index], output[index + 1]);
      assert.equal(output[index], output[index + 2]);
    }
  }
});
