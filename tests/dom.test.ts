import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, requiredElement } from '../src/dom.ts';
import { RocketPhysics, guidanceMode } from '../src/rocket_physics.ts';
import { ROCKET_DEFAULTS } from '../src/launch-settings.ts';

test('escapeHtml escapes all five HTML metacharacters without altering plain text', () => {
  assert.equal(escapeHtml('Plain text · 9.81 m/s²'), 'Plain text · 9.81 m/s²');
  assert.equal(
    escapeHtml(`5 < 9 & 9 > 5 "quote" 'apostrophe'`),
    '5 &lt; 9 &amp; 9 &gt; 5 &quot;quote&quot; &#39;apostrophe&#39;'
  );
  assert.equal(escapeHtml(''), '');
});

test('required controls preserve their identity and fail clearly on missing or mismatched markup', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const input = { localName:'input', value:'5' }, label = { localName:'p' };
  const nodes: Record<string, typeof input | typeof label> = { mass:input, label };
  Object.defineProperty(globalThis, 'document', { configurable:true, value:{ getElementById:(id:string) => nodes[id] ?? null } });
  try {
    assert.equal(requiredElement('mass', 'input'), input);
    assert.equal(requiredElement('label', 'p'), label);
    assert.throws(() => requiredElement('missing', 'input'), /Expected <input> with id="missing"/);
    assert.throws(() => requiredElement('label', 'input'), /Expected <input> with id="label"/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('external guidance selections are narrowed and partial pitch programs use usable defaults', () => {
  for (const mode of ['fixed', 'pitch_program', 'prograde_lock', 'orbit_assist'] as const) assert.equal(guidanceMode(mode), mode);
  assert.equal(guidanceMode('unknown'), 'fixed');
  const config = { ...ROCKET_DEFAULTS, guidanceMode:'pitch_program' as const };
  const { pitchEnd, pitchT1, pitchT2, ...partial } = config;
  const guidance = RocketPhysics.buildGuidance(partial), state = RocketPhysics.createRocketState(partial);
  assert.equal(guidance.getAngle({ ...state, time:0 }), partial.launchAngle);
  assert.equal(guidance.getAngle({ ...state, time:20 }), 45);
});
