import { Physics } from './physics.ts';
import { RocketPhysics } from './rocket_physics.ts';
import { pressureAtAltitude } from './environment.ts';
import { ESCAPE_CENTRE_RADII, planBallisticCoast, sampleBallisticCoast, type BallisticCoast } from './ballistic-coast.ts';
import { planOrbitalCoast, sampleOrbitalCoast, orbitalSampleTimes, orbitalEvents, type OrbitalCoast } from './orbital-coast.ts';
import type { RocketConfig, RocketState, Guidance } from './rocket_physics.ts';
import type { ProjectileState } from './physics.ts';
import type { CannonConfig, LaunchSettings } from './launch-settings.ts';
import type { Environment, CoastBody } from './environment.ts';

export type FlightWorld = { gravity:number; planetRadius?:number; environment?:Environment | null };
export type CannonFlightConfig = Partial<CannonConfig> & FlightWorld;
export type RocketFlightConfig = RocketConfig & FlightWorld;

export type FlightEvent = { time: number; kind: string; label: string };
export type FlightOutcome = 'impact' | 'orbit' | 'escape' | 'no-liftoff' | 'limit' | 'invalid';
export type FlightSample = ProjectileState | RocketState;
export type SampleInput = { time: number } & Partial<RocketState & ProjectileState>;

type FlightBase<S extends CoastBody, C> = {
  id: number;
  samples: S[];
  events: FlightEvent[];
  duration: number;
  outcome: FlightOutcome;
  maxHeight: number;
  minX: number;
  maxX: number;
  launchX: number;
  coast?: BallisticCoast<S>;
  orbit?: OrbitalCoast<RocketState>;
  orbitLaps?: number;
  config: Readonly<C>;
};

export type CannonFlightRecord = FlightBase<ProjectileState, CannonFlightConfig> & { mode: 'cannon' };
export type RocketFlightRecord = FlightBase<RocketState, RocketFlightConfig> & { mode: 'rocket' };
export type FlightRecord = CannonFlightRecord | RocketFlightRecord;

export const PHYSICS_STEP = 1 / 120;
export const MIN_CANNON_PATH_POINTS = 20;
export const MAX_RECORD_TIME = 21600;
let nextId = 1;

function freezeConfiguration<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value)) freezeConfiguration(child, seen);
    Object.freeze(value);
  }
  return value;
}

const isRocketSample = (sample: FlightSample): sample is RocketState => 'mProp' in sample;

/** One canonical run; rendering rate never enters either integrator. Yield often
 * so Reset can cancel even a very long orbital/low-thrust experiment. */
export function recordFlight(mode:'cannon', config:CannonFlightConfig, initial:ProjectileState,
  signal?:AbortSignal, options?:{maxTime?:number}):Promise<CannonFlightRecord>;
export function recordFlight(mode:'rocket', config:RocketFlightConfig, initial:RocketState,
  signal?:AbortSignal, options?:{maxTime?:number}):Promise<RocketFlightRecord>;
export async function recordFlight(mode: FlightRecord['mode'], config: CannonFlightConfig | RocketFlightConfig, initial: FlightSample,
  signal?: AbortSignal, options: { maxTime?: number } = {}): Promise<FlightRecord> {
  const saved = freezeConfiguration(structuredClone(config));
  const maxTime = options.maxTime !== undefined && Number.isFinite(options.maxTime) && options.maxTime > 0
    ? Math.min(MAX_RECORD_TIME, options.maxTime) : MAX_RECORD_TIME;
  const samples: FlightSample[] = [{ ...initial }];
  const events: FlightEvent[] = [{ time: 0, kind: 'launch', label: mode === 'rocket' ? 'Ignition' : 'Launch' }];
  let outcome: FlightOutcome = 'limit';
  let maxHeight = initial.y, minX = initial.x, maxX = initial.x;
  let coastPlan: BallisticCoast<FlightSample> | undefined;
  let orbitPlan: OrbitalCoast<RocketState> | undefined;
  let orbitLaps: number | undefined;
  const id = nextId++, launchX = initial.x;
  const guidance = mode === 'rocket' ? RocketPhysics.buildGuidance(saved as RocketFlightConfig) : undefined;
  let state: FlightSample = structuredClone(initial), sampleInterval = 0.1, sampleAt = sampleInterval;
  let deadline = performance.now() + 8, classifiedAt: number | null = null;
  let classification: 'orbit' | 'escape' | null = null;
  let coastChecked = false;
  const eventTimes = new Set<number>([0]);
  const step = (before: FlightSample, duration: number): FlightSample => mode === 'rocket'
    ? RocketPhysics.stepRocket(before as RocketState, duration, saved.gravity, guidance)
    : Physics.stepProjectile(before as ProjectileState, duration, saved.gravity);
  const addEvent = (time: number, kind: string, label: string) => {
    if (Number.isFinite(time) && !events.some(e => e.kind === kind && Math.abs(e.time - time) < 0.05))
      events.push({ time, kind, label });
  };
  const recordEventState = (before: FlightSample, time: number, fields: Partial<RocketState & ProjectileState> = {}) => {
    if (!Number.isFinite(time) || time < before.time) return;
    eventTimes.add(time);
    samples.push({ ...step(before, Math.max(0, time - before.time)), ...fields, time } as FlightSample);
  };
  const buildRun = (duration: number): FlightRecord => mode === 'cannon'
    ? { id, mode: 'cannon', config: saved as Readonly<CannonFlightConfig>, samples: samples as ProjectileState[],
        events, duration, outcome, maxHeight, minX, maxX, launchX,
        ...(coastPlan ? { coast: coastPlan as BallisticCoast<ProjectileState> } : {}) }
    : { id, mode: 'rocket', config: saved as Readonly<RocketFlightConfig>, samples: samples as RocketState[],
        events, duration, outcome, maxHeight, minX, maxX, launchX,
        ...(coastPlan ? { coast: coastPlan as BallisticCoast<RocketState> } : {}),
        ...(orbitPlan ? { orbit: orbitPlan } : {}),
        ...(orbitLaps !== undefined ? { orbitLaps } : {}) };

  for (let i = 0; i < Math.ceil(maxTime / PHYSICS_STEP) && state.time < maxTime; i++) {
    if (signal?.aborted) throw new DOMException('Flight cancelled', 'AbortError');
    if (mode === 'rocket' && isRocketSample(state) && options.maxTime === undefined && !state.engineOn) {
      const orbit = planOrbitalCoast(state, saved.gravity);
      if (orbit) {
        orbitPlan = orbit; orbitLaps = 1;
        addEvent(state.time, 'orbit', 'Orbit established · engine off');
        for (const event of orbitalEvents(orbit)) addEvent(event.time, event.kind, event.label);
        const orbitRun = buildRun(orbit.endTime) as RocketFlightRecord;
        for (const time of [...new Set([...orbitalSampleTimes(orbit), orbit.endTime,
          ...events.filter(event => event.time >= state.time).map(event => event.time)])].sort((a, b) => a - b)) {
          const sample = sampleOrbit(orbitRun, time, guidance);
          samples.push(sample);
          minX = Math.min(minX, sample.x); maxX = Math.max(maxX, sample.x);
          if (performance.now() >= deadline) {
            await new Promise(resolve => setTimeout(resolve, 0)); deadline = performance.now() + 8;
            if (signal?.aborted) throw new DOMException('Flight cancelled', 'AbortError');
          }
        }
        maxHeight = Math.max(maxHeight, orbit.apoapsisAltitude);
        state = sampleOrbit(orbitRun, orbit.endTime, guidance);
        outcome = 'orbit'; addEvent(state.time, 'lap', 'One complete orbit'); break;
      }
    }
    // Resolve long, unpowered journeys exactly instead of clipping an ellipse
    // at the numerical recording limit. Short flights keep their usual solver;
    // explicit observation limits and all powered motion still use that path.
    const unpowered = !isRocketSample(state) || !state.engineOn;
    if (options.maxTime === undefined && !coastChecked && unpowered) {
      const coast = planBallisticCoast(state, saved.gravity);
      if (coast) {
        coastChecked = true;
        if (coast.outcome === 'escape' || coast.endTime > MAX_RECORD_TIME) {
          coastPlan = coast;
          if (coast.outcome === 'escape') addEvent(state.time, 'escape', 'Escape velocity reached');
          if (coast.apexTime !== null) addEvent(coast.apexTime, 'apex', 'Highest point');
          if (coast.outcome === 'impact') addEvent(coast.endTime, 'impact', 'Surface contact');
          if (mode === 'rocket' && (saved as RocketFlightConfig).guidanceMode === 'pitch_program') {
            const rc = saved as RocketFlightConfig;
            for (const [time, label] of [[rc.pitchT1!, 'Pitch begins'], [rc.pitchT2!, 'Pitch complete']] as [number, string][]) {
              if (time > state.time && time <= coast.endTime) addEvent(time, 'guidance', label);
            }
          }
          // Uniform samples draw the distant arc; logarithmic samples at both
          // ends preserve the much faster motion close to the launch/landing.
          const duration = coast.endTime - state.time, times = new Set<number>([state.time, coast.endTime]);
          for (let j = 1; j < 512; j++) times.add(state.time + duration * j / 512);
          for (let j = 1; j <= 1024; j++) {
            const offset = Math.expm1(Math.log1p(duration / 2) * j / 1024);
            times.add(state.time + offset); times.add(coast.endTime - offset);
          }
          for (const event of events) if (event.time >= state.time) times.add(event.time);
          const coastRun = buildRun(coast.endTime);
          for (const time of [...times].sort((a, b) => a - b)) {
            if (signal?.aborted) throw new DOMException('Flight cancelled', 'AbortError');
            const sample = sampleCoast(coastRun, time, guidance);
            samples.push(sample);
            maxHeight = Math.max(maxHeight, sample.y, sample.apexHeight ?? 0);
            minX = Math.min(minX, sample.x); maxX = Math.max(maxX, sample.x);
            if (performance.now() >= deadline) {
              await new Promise(resolve => setTimeout(resolve, 0)); deadline = performance.now() + 8;
            }
          }
          state = sampleCoast(coastRun, coast.endTime, guidance); outcome = coast.outcome; break;
        }
      }
    }
    const before = state;
    state = step(before, Math.min(PHYSICS_STEP, maxTime - before.time));
    if (![state.x, state.y, state.vx, state.vy, state.time].every(Number.isFinite)) {
      outcome = 'invalid'; state = before; break;
    }
    maxHeight = Math.max(maxHeight, state.y, state.apexHeight ?? 0);
    minX = Math.min(minX, state.x); maxX = Math.max(maxX, state.x);
    if (mode === 'rocket' && isRocketSample(state) && isRocketSample(before) && state.burnoutTime != null && before.burnoutTime == null) {
      addEvent(state.burnoutTime, 'burnout', state.cutoffReason === 'orbit' ? 'Orbit insertion · engine cutoff'
        : state.cutoffReason === 'planned' ? 'Planned engine cutoff' : 'Engine cutoff · fuel empty');
      recordEventState(before, state.burnoutTime, { engineOn: false, mProp: state.mProp, mass: state.mass,
        thrustMagnitude: 0, mdot: 0, burnoutTime: state.burnoutTime, burnoutSpeed: state.burnoutSpeed,
        cutoffReason: state.cutoffReason });
    }
    const fizzled = isRocketSample(state) && state.fizzled;
    if (state.apexTime != null && state.apexTime !== before.apexTime && !fizzled) {
      addEvent(state.apexTime, 'apex', 'Highest point');
      recordEventState(before, state.apexTime, { apexTime: state.apexTime, apexHeight: state.apexHeight, vy: 0 });
    }
    if (mode === 'rocket' && (saved as RocketFlightConfig).guidanceMode === 'pitch_program') {
      const rc = saved as RocketFlightConfig;
      for (const [time, label] of [[rc.pitchT1!, 'Pitch begins'], [rc.pitchT2!, 'Pitch complete']] as [number, string][]) {
        if (time > before.time && time <= state.time) {
          addEvent(time, 'guidance', label); recordEventState(before, time);
        }
      }
    }
    if (state.time >= sampleAt) {
      samples.push({ ...state }); sampleAt = state.time + sampleInterval;
      if (samples.length > 16000) {
        const thinned = samples.filter((sample, index) => index % 2 === 0 || eventTimes.has(sample.time));
        samples.length = 0; samples.push(...thinned);
        sampleInterval *= 2;
      }
    }
    if (fizzled || state.outcome === 'no-liftoff') {
      outcome = 'no-liftoff'; addEvent(state.time, 'no-liftoff', 'No lift-off'); break;
    }
    if (state.outcome === 'impact') {
      // Keep the final incoming canonical step; contact itself has zero velocity.
      samples.push({ ...before });
      outcome = 'impact'; addEvent(state.time, 'impact', 'Surface contact'); break;
    }
    if (i % 60 === 0 && (mode === 'cannon' || (isRocketSample(state) && !state.engineOn))) {
      const info = (mode === 'cannon' ? Physics : RocketPhysics).classifyTrajectory(state, saved.gravity);
      if ((info.kind === 'orbit' || info.kind === 'escape') && classifiedAt === null) {
        classifiedAt = state.time; classification = info.kind;
        addEvent(state.time, info.kind, info.kind === 'orbit' ? 'Orbit established' : 'Escape trajectory');
        eventTimes.add(state.time); samples.push({ ...state });
      }
    }
    const escapeVisible = classification !== 'escape' || state.y >= (ESCAPE_CENTRE_RADII - 1) * state.planetRadius;
    if (classifiedAt !== null && classification !== null && state.time >= classifiedAt + 20 && escapeVisible) {
      outcome = classification; break;
    }
    if (performance.now() >= deadline) {
      await new Promise(resolve => setTimeout(resolve, 0)); deadline = performance.now() + 8;
    }
  }
  if (signal?.aborted) throw new DOMException('Flight cancelled', 'AbortError');
  // The observation cap may stop a very slow escape first. Its known physical
  // outcome remains escape; the end event still explains why recording stops.
  const observationLimit = outcome === 'limit';
  if (observationLimit && classification) outcome = classification;
  const duration = state.time;
  samples.push({ ...state });
  // The final state wins equal timestamps, especially a rejected ignition at t=0.
  const deduped = [...new Map(samples.map(sample => [sample.time, sample])).values()]
    .sort((a, b) => a.time - b.time);
  samples.length = 0; samples.push(...deduped);
  const run = buildRun(duration);
  if (run.mode === 'cannon' && run.duration > 0 && run.samples.length < MIN_CANNON_PATH_POINTS) {
    // Very high gravity can make a complete flight shorter than the normal
    // 0.1 s recording interval. Re-evaluate the canonical solution at evenly
    // spaced inspection times so the plotted arc still has a useful shape.
    const plotSamples = Array.from({ length: MIN_CANNON_PATH_POINTS }, (_, index) =>
      sampleFlight(run, run.duration * index / (MIN_CANNON_PATH_POINTS - 1)));
    run.samples = [...new Map([...plotSamples, ...run.samples].map(sample => [sample.time, sample])).values()]
      .sort((a, b) => a.time - b.time);
  }
  for (const event of run.events) {
    if (event.kind === 'apex' && event.time !== state.apexTime) event.label = 'Local high point';
  }
  addEvent(run.duration, 'end', observationLimit ? 'Observation limit' : 'Result');
  run.events.sort((a, b) => a.time - b.time);
  return run;
}

function sampleOrbit(run: FlightRecord, time: number, guidance?: Guidance): RocketState {
  if (run.mode !== 'rocket') throw new Error('Only rocket flights have recorded orbits.');
  guidance ??= RocketPhysics.buildGuidance(run.config);
  const state = sampleOrbitalCoast(run.orbit!, time), initial = run.orbit!.initial;
  Object.assign(state, { engineOn: false, thrustMagnitude: 0, mdot: 0, Isp: 0, flowRegime: 'off',
    gravityImpulseX: initial.gravityImpulseX + state.wvx - initial.wvx,
    gravityImpulseY: initial.gravityImpulseY + state.wvy - initial.wvy });
  if (state.environment) state.Pa_Pa = pressureAtAltitude(state.environment, state.y);
  state.theta = guidance.mode === 'orbit_assist' ? Math.atan2(state.vy, state.vx) * 180 / Math.PI : guidance.getAngle(state);
  return state;
}

/** Extend observation, not physics: an unpowered ellipse has no expiry. Keep a
 * single complete circuit for drawing so repeated observation has bounded memory. */
export function continueOrbit(run: FlightRecord): boolean {
  if (run.mode !== 'rocket' || !run.orbit || run.outcome !== 'orbit') return false;
  const lap = run.orbitLaps ?? 1;
  run.orbitLaps = lap + 1;
  run.duration = run.orbit.initial.time + (lap + 1) * run.orbit.period;
  const launchSamples = run.samples.filter(sample => sample.time < run.orbit!.initial.time);
  // The first circuit is also the complete geometric trail for later laps.
  // Keeping it preserves the original replay and avoids an ever-growing path.
  run.samples = [...launchSamples, ...orbitalSampleTimes(run.orbit).map(time => sampleOrbit(run, time))];
  run.samples.push(sampleOrbit(run, run.duration));
  run.events = run.events.filter(event => event.time <= run.orbit!.initial.time);
  run.events.push(...orbitalEvents(run.orbit));
  for (const event of orbitalEvents(run.orbit)) run.events.push({ ...event, time: event.time + lap * run.orbit.period });
  run.events.push({ time: run.duration, kind: 'lap', label: `${lap + 1} complete orbits` },
    { time: run.duration, kind: 'end', label: 'Result' });
  run.events.sort((a, b) => a.time - b.time);
  return true;
}

function sampleCoast(run: CannonFlightRecord, time: number, guidance?: null): ProjectileState;
function sampleCoast(run: RocketFlightRecord, time: number, guidance?: Guidance | null): RocketState;
function sampleCoast(run: FlightRecord, time: number, guidance?: Guidance | null): FlightSample;
function sampleCoast(run: FlightRecord, time: number, guidance: Guidance | null = run.mode === 'rocket' ? RocketPhysics.buildGuidance(run.config) : null): FlightSample {
  if (run.mode === 'cannon') return sampleBallisticCoast(run.coast!, time);
  const plan = run.coast!, state = sampleBallisticCoast(plan, time), initial = plan.initial;
  // At contact use incoming velocity for the accumulated gravitational impulse.
  const longitude = state.x / state.planetRadius;
  const vx = state.outcome === 'impact' && state.impactVx != null && state.impactVy != null
    ? state.impactVx * Math.cos(longitude) + state.impactVy * Math.sin(longitude) : state.wvx;
  const vy = state.outcome === 'impact' && state.impactVx != null && state.impactVy != null
    ? -state.impactVx * Math.sin(longitude) + state.impactVy * Math.cos(longitude) : state.wvy;
  Object.assign(state, { engineOn: false, thrustMagnitude: 0, mdot: 0, Isp: 0, flowRegime: 'off',
    gravityImpulseX: initial.gravityImpulseX + vx - initial.wvx,
    gravityImpulseY: initial.gravityImpulseY + vy - initial.wvy });
  if (state.environment) state.Pa_Pa = pressureAtAltitude(state.environment, state.y);
  state.theta = (guidance ?? RocketPhysics.buildGuidance(run.config)).getAngle(state);
  return state;
}

/** Rebuild the state at an inspection time with the same canonical solver used
 * to record the flight. Sparse samples keep long runs compact, but linear
 * interpolation is not valid during a high-mass-ratio burn because rocket
 * velocity varies logarithmically with mass.
 */
function resamplePhysics(run: FlightRecord, start: SampleInput, time: number): FlightSample | null {
  if ((run.mode !== 'cannon' && run.mode !== 'rocket') ||
      !run.config || !Number.isFinite(run.config.gravity) ||
      !Number.isFinite(start?.time) || start.time > time) return null;
  if (run.mode === 'cannon') {
    let state = { ...(start as ProjectileState) };
    while (time - state.time > PHYSICS_STEP + 1e-12) {
      const next = Physics.stepProjectile(state, PHYSICS_STEP, run.config.gravity);
      if (!(next.time > state.time)) return null;
      state = next;
    }
    const remainder = time - state.time;
    if (remainder > 1e-12) state = Physics.stepProjectile(state, remainder, run.config.gravity);
    return { ...state, time };
  }
  const guidance = RocketPhysics.buildGuidance(run.config);
  let state = { ...(start as RocketState) };
  while (time - state.time > PHYSICS_STEP + 1e-12) {
    const next = RocketPhysics.stepRocket(state, PHYSICS_STEP, run.config.gravity, guidance);
    if (!(next.time > state.time)) return null;
    state = next;
  }
  const remainder = time - state.time;
  if (remainder > 1e-12) state = RocketPhysics.stepRocket(state, remainder, run.config.gravity, guidance);
  return { ...state, time };
}

const INTERPOLATED_FIELDS = ['x', 'y', 'vx', 'vy', 'wx', 'wy', 'wvx', 'wvy', 'mass', 'mProp', 'totalImpulse',
  'idealDeltaV', 'thrustMagnitude', 'mdot', 'Isp', 'Pa_Pa', 'gravityImpulseX', 'gravityImpulseY'] as const;

type PartialFlightLike<S extends SampleInput> = {
  duration: number;
  samples: S[];
  mode?: string;
  config?: { gravity: number };
  orbit?: OrbitalCoast<RocketState>;
  coast?: BallisticCoast<CoastBody>;
};

export function sampleFlight(run: CannonFlightRecord, time: number): ProjectileState;
export function sampleFlight(run: RocketFlightRecord, time: number): RocketState;
export function sampleFlight(run: FlightRecord, time: number): FlightSample;
export function sampleFlight<S extends SampleInput>(run: PartialFlightLike<S>, time: number): S;
export function sampleFlight<S extends SampleInput>(run: PartialFlightLike<S>, time: number): S | FlightSample {
  const samples = run.samples;
  if (time >= run.duration) return { ...samples[samples.length - 1] };
  if (time <= 0) return { ...samples[0] };
  if ((run.mode === 'cannon' || run.mode === 'rocket') && run.config) {
    const fullRun = run as unknown as FlightRecord;
    if (fullRun.orbit && time >= fullRun.orbit.initial.time) return sampleOrbit(fullRun, time);
    if (fullRun.coast && time >= fullRun.coast.initial.time) return sampleCoast(fullRun, time);
  }
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (samples[mid].time <= time) lo = mid; else hi = mid; }
  const a = samples[lo], b = samples[hi];
  if (Math.abs(time - a.time) <= 1e-12) return { ...a };
  if ((run.mode === 'cannon' || run.mode === 'rocket') && run.config) {
    const physical = resamplePhysics(run as unknown as FlightRecord, a, time);
    if (physical) return physical;
  }
  const fraction = (time - a.time) / (b.time - a.time);
  const state: S = { ...a, time };
  // Interpolate toward the incoming contact velocity, never toward the stopped
  // object. The actual contact sample then switches to its terminal state.
  const endpoint: S = { ...b };
  if (b.outcome === 'impact' && b.impactVx != null && b.impactVy != null) {
    endpoint.vx = b.impactVx; endpoint.vy = b.impactVy;
    if (b.planetRadius && b.planetRadius > 0 && typeof b.x === 'number') {
      const angle = b.x / b.planetRadius;
      endpoint.wvx = b.impactVx * Math.cos(angle) + b.impactVy * Math.sin(angle);
      endpoint.wvy = -b.impactVx * Math.sin(angle) + b.impactVy * Math.cos(angle);
    }
  }
  if (a.engineOn && !b.engineOn) { endpoint.thrustMagnitude = a.thrustMagnitude; endpoint.mdot = a.mdot; }
  const target = state as Record<string, unknown>;
  const from = a as Record<string, unknown>;
  const to = endpoint as Record<string, unknown>;
  for (const key of INTERPOLATED_FIELDS) {
    const startVal = from[key], endVal = to[key];
    if (typeof startVal === 'number' && typeof endVal === 'number') {
      target[key] = startVal + (endVal - startVal) * fraction;
    }
  }
  if (typeof a.theta === 'number' && typeof b.theta === 'number') {
    const difference = (b.theta - a.theta) * Math.PI / 180;
    state.theta = a.theta + Math.atan2(Math.sin(difference), Math.cos(difference)) * 180 / Math.PI * fraction;
  }
  return state;
}

export function compatibleRuns(a: FlightRecord | null, b: FlightRecord | null): boolean {
  return !!a && !!b && a.mode === b.mode && a.config.gravity === b.config.gravity &&
    a.config.planetRadius === b.config.planetRadius;
}

export function describeChanges(a: FlightRecord, b: FlightRecord): string {
  const names = { angle: 'angle', force: 'force', mass: 'mass', barrelLength: 'barrel length',
    gravity: 'gravity', dryMass: 'dry mass', propMass: 'fuel load', launchAngle: 'launch angle',
    propellantId: 'propellant', Pc_bar: 'chamber pressure', throatDia_mm: 'throat', epsilon: 'nozzle',
    MR: 'mixture', etaC: 'combustion efficiency', etaN: 'nozzle efficiency', guidanceMode: 'guidance',
    pitchEnd: 'pitch angle', pitchT1: 'pitch start', pitchT2: 'pitch finish', progradeVmin: 'prograde threshold',
    cutoffTime: 'engine cutoff time',
    orbitAltitudeKm: 'target orbit altitude' };
  const changed = Object.entries(names).filter(([key]) =>
    (a.config as LaunchSettings)[key as keyof LaunchSettings] !== (b.config as LaunchSettings)[key as keyof LaunchSettings]
  ).map(([, name]) => name);
  return changed.length ? `Changed: ${changed.join(', ')}` : 'Same settings — repeat experiment';
}
