import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ENVIRONMENTS, GRAVITY_MIN, GRAVITY_MAX, clampGravity, environmentByName, resolveEnvironment } from '../src/environment.ts';
import { PLANET_FACTS } from '../src/planet-facts.ts';
import { WORLD_CHARACTERS, characterForWorld } from '../src/world-characters.ts';
import { WORLD_ART } from '../src/world-art.ts';

test('every selectable world has a complete compact fact card', () => {
  const worlds = ENVIRONMENTS.map(environment => environment.name).sort();
  assert.deepEqual(Object.keys(PLANET_FACTS).sort(), worlds);
  assert.deepEqual(Object.keys(WORLD_CHARACTERS).sort(), worlds);

  for (const fact of Object.values(PLANET_FACTS)) {
    for (const key of ['name', 'kind', 'tagline', 'mass', 'diameter', 'distance',
      'gravity', 'dayLength', 'yearLength', 'axialTilt',
      'averageTemp', 'minTemp', 'maxTemp', 'temperatureNote', 'atmosphere', 'exploration'] as const) {
      assert.ok(fact[key]?.trim(), `${fact.id}.${key} is present`);
    }
    assert.ok(fact.atmosphere.length <= 210, `${fact.id} atmosphere copy fits the fixed card`);
    assert.ok(fact.exploration.length <= 240, `${fact.id} exploration copy fits the fixed card`);
  }
});

test('every world has lightweight transparent artwork for the picker and fact card', async () => {
  const worlds = ENVIRONMENTS.map(environment => environment.name).sort();
  assert.deepEqual(Object.keys(WORLD_ART).sort(), worlds);
  for (const [world, art] of Object.entries(WORLD_ART)) {
    assert.notEqual(art.mini, art.full);
    const mini = await stat(fileURLToPath(art.mini));
    const full = await stat(fileURLToPath(art.full));
    assert.ok(mini.size > 500 && mini.size < 30_000, `${world} picker art is lightweight`);
    assert.ok(full.size > mini.size && full.size < 200_000, `${world} fact art is detailed but efficient`);
  }
});

test('new world presets retain their measured scale and intended inhabitants', () => {
  const pluto = resolveEnvironment(.62);
  assert.equal(pluto.name, 'pluto');
  assert.equal(pluto.radius, 1_188_300);
  assert.equal(pluto.isGas, false);
  assert.ok(Math.abs(pluto.gravity * pluto.radius ** 2 / 8.696e11 - 1) < .01);
  assert.equal(characterForWorld('pluto'), 'icebear');

  const sun = resolveEnvironment(274);
  assert.equal(sun.name, 'sun');
  assert.equal(sun.radius, 695_700_000);
  assert.equal(sun.isGas, true);
  assert.ok(Math.abs(sun.gravity * sun.radius ** 2 / 1.3271244e20 - 1) < .01);
  assert.equal(characterForWorld('sun'), null);

  const ganymede = resolveEnvironment(1.428);
  assert.equal(ganymede.name, 'ganymede');
  assert.equal(ganymede.radius, 2_634_100);
  assert.equal(ganymede.isGas, false);
  assert.equal(ganymede.surfacePressure, 0);
  assert.ok(Math.abs(ganymede.gravity * ganymede.radius ** 2 / 9.8878e12 - 1) < .01);
  assert.equal(characterForWorld('ganymede'), 'squid');
});

test('world picker replaces the old note with the fact dialog controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="environment-note"/);
  assert.doesNotMatch(html, /data-gravity=/, 'world gravity lives once in ENVIRONMENTS');
  assert.match(html, /id="planet-fact-button"/);
  assert.match(html, /id="planet-fact-dialog"/);
  assert.match(html, /id="planet-fact-artwork"/);
  for (const id of ['gravity', 'day', 'year', 'tilt']) {
    assert.match(html, new RegExp(`id="planet-fact-${id}"`));
  }
  const orderedWorlds = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars',
    'jupiter', 'ganymede', 'saturn', 'uranus', 'neptune', 'pluto'];
  const pickerPositions = orderedWorlds.map(world => html.indexOf(`data-planet="${world}"`));
  assert.ok(pickerPositions.every((position, index) =>
    position >= 0 && (index === 0 || position > pickerPositions[index - 1])));
});

test('picker buttons map 1:1 to the shared environment table and stay within gravity bounds', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const buttonNames = [...html.matchAll(/class="planet-btn[^"]*"[^>]*data-planet="([a-z]+)"/g)]
    .map(([, name]) => name);
  const presetNames = ENVIRONMENTS.map(({ name }) => name);
  assert.deepEqual([...buttonNames].sort(), [...presetNames].sort());
  for (const name of buttonNames) {
    const preset = environmentByName(name);
    assert.ok(preset, `${name} resolves from ENVIRONMENTS`);
    assert.ok(preset.gravity >= GRAVITY_MIN && preset.gravity <= GRAVITY_MAX, `${name} preset is within bounds`);
  }
  assert.equal(environmentByName('unknown'), undefined);
  assert.ok(clampGravity(1e9) === GRAVITY_MAX && clampGravity(-1) === GRAVITY_MIN);
});
