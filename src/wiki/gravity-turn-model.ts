import { classifyTrajectory, type CoastBody } from '../environment.ts';
import { planBallisticCoast, sampleBallisticCoast, type BallisticCoast } from '../ballistic-coast.ts';
import { orbitalEvents, orbitalSampleTimes, planOrbitalCoast, sampleOrbitalCoast, type OrbitalCoast } from '../orbital-coast.ts';

export interface TurnSettings {
  pitch: number;
  burn: number;
  kickBurn?: number;
}

export const TURN_PRESETS = [
  { name: 'Elliptical orbit', pitch: 13, burn: 0.56, kickBurn: 0 },
  { name: 'Circularised', pitch: 13, burn: 0.56, kickBurn: 0.0146 },
  { name: 'Transfer + kick', pitch: 9, burn: 0.55, kickBurn: 0.0284 },
  { name: 'Straight up', pitch: 0, burn: 0.56, kickBurn: 0 },
  { name: 'Short burn', pitch: 13, burn: 0.45, kickBurn: 0 },
  { name: 'Hard turn', pitch: 25, burn: 0.56, kickBurn: 0 },
] as const;

export const TURN_PITCH_TIME = 0.08;
export const TURN_MAX_KICK = 0.1;
const MASS_FLOW = 1.12;
const INITIAL_THRUST_ACCELERATION = 1.45;
const MIN_DRY_MASS = 0.14;
const STEP = 0.002;
const KICK_STEP = 0.0005;
// Integrate with radius and surface gravity both equal to one. Scale the
// cutoff state for the shared coast solvers, whose clearance is in metres.
const RADIUS = 1e6;

export interface TurnFrame {
  time: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
}

export type TurnOutcome = 'orbit' | 'returning' | 'escape' | 'powered-impact';

export interface TurnFlight {
  ascent: TurnFrame[];
  transfer: TurnFrame[];
  kickArc: TurnFrame[];
  coast: TurnFrame[];
  unburnedCoast: TurnFrame[];
  outcome: TurnOutcome;
  circular: boolean;
  eccentricity: number | null;
  periapsis: number | null;
  apoapsis: number | null;
  apoapsisPoint: TurnFrame | null;
  periapsisPoint: TurnFrame | null;
  circulariseBurn: number | null;
  cutoff: TurnFrame;
  kickCutoff: TurnFrame | null;
}

function acceleration({ x, y, vx, vy, mass }: TurnFrame) {
  const radius = Math.hypot(x, y);
  const speed = Math.hypot(vx, vy);
  const thrustAcceleration = INITIAL_THRUST_ACCELERATION / mass;
  return [
    (speed ? vx / speed : 0) * thrustAcceleration - x / radius ** 3,
    (speed ? vy / speed : 1) * thrustAcceleration - y / radius ** 3,
  ];
}

// Midpoint integration follows the velocity with thrust after pitch-over and during the apoapsis kick.
function advance(frame: TurnFrame, dt: number): TurnFrame {
  const [ax, ay] = acceleration(frame);
  const mid: TurnFrame = {
    time: frame.time + dt / 2,
    x: frame.x + frame.vx * dt / 2,
    y: frame.y + frame.vy * dt / 2,
    vx: frame.vx + ax * dt / 2,
    vy: frame.vy + ay * dt / 2,
    mass: frame.mass - MASS_FLOW * dt / 2,
  };
  const [mx, my] = acceleration(mid);
  return {
    time: frame.time + dt,
    x: frame.x + mid.vx * dt,
    y: frame.y + mid.vy * dt,
    vx: frame.vx + mx * dt,
    vy: frame.vy + my * dt,
    mass: frame.mass - MASS_FLOW * dt,
  };
}

export function interpolateTurnFrame(a: TurnFrame, b: TurnFrame, fraction: number): TurnFrame {
  const mix = (start: number, end: number) => start + (end - start) * fraction;
  return {
    time: mix(a.time, b.time), x: mix(a.x, b.x), y: mix(a.y, b.y),
    vx: mix(a.vx, b.vx), vy: mix(a.vy, b.vy), mass: mix(a.mass, b.mass),
  };
}

function surfaceContact(before: TurnFrame, after: TurnFrame) {
  let low = 0, high = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    const { x, y } = interpolateTurnFrame(before, after, mid);
    if (Math.hypot(x, y) > 1) low = mid;
    else high = mid;
  }
  return interpolateTurnFrame(before, after, low);
}

function toCoastBody(frame: TurnFrame): CoastBody {
  return {
    time: frame.time, planetRadius: RADIUS, engineOn: false, outcome: 'flight',
    wx: frame.x * RADIUS, wy: frame.y * RADIUS, wvx: frame.vx * RADIUS, wvy: frame.vy * RADIUS,
    x: Math.atan2(frame.x, frame.y) * RADIUS, y: (Math.hypot(frame.x, frame.y) - 1) * RADIUS,
    vx: 0, vy: 0, apexTime: null, apexHeight: null,
    impactTime: null, impactSpeed: null, impactVx: null, impactVy: null,
  };
}

function fromCoastBody(state: CoastBody, mass: number): TurnFrame {
  return {
    time: state.time, x: state.wx / RADIUS, y: state.wy / RADIUS,
    vx: state.wvx / RADIUS, vy: state.wvy / RADIUS, mass,
  };
}

function sampleBallisticArc(plan: BallisticCoast, startTime: number, endTime: number, mass: number, count = 321): TurnFrame[] {
  return Array.from({ length: count }, (_, i) => {
    const fraction = (1 - Math.cos(Math.PI * i / (count - 1))) / 2;
    const time = startTime + fraction * (endTime - startTime);
    return fromCoastBody(sampleBallisticCoast(plan, time), mass);
  });
}

function sampleOrbitalArc(plan: OrbitalCoast, startTime: number, endTime: number, mass: number, count = 181): TurnFrame[] {
  return Array.from({ length: count }, (_, i) => {
    const time = startTime + (i / (count - 1)) * (endTime - startTime);
    return fromCoastBody(sampleOrbitalCoast(plan, time), mass);
  });
}

function lowestFrame(frames: TurnFrame[]): TurnFrame | null {
  if (frames.length === 0) return null;
  let best = frames[0];
  let bestR = Math.hypot(best.x, best.y);
  for (const frame of frames) {
    const r = Math.hypot(frame.x, frame.y);
    if (r < bestR) {
      bestR = r;
      best = frame;
    }
  }
  return best;
}

interface CoastPlanSummary {
  coast: TurnFrame[];
  outcome: Exclude<TurnOutcome, 'powered-impact'>;
  eccentricity: number | null;
  periapsis: number | null;
  apoapsis: number | null;
  periapsisPoint: TurnFrame | null;
  apoapsisTime: number | null;
  apoapsisPoint: TurnFrame | null;
  orbit: OrbitalCoast | null;
  ballistic: BallisticCoast | null;
}

function evaluateCoast(cutoff: TurnFrame): CoastPlanSummary {
  const initial = toCoastBody(cutoff);
  const classification = classifyTrajectory(initial, RADIUS);
  const orbit = planOrbitalCoast(initial, RADIUS);
  if (orbit) {
    const coast = orbitalSampleTimes(orbit).map(time => fromCoastBody(sampleOrbitalCoast(orbit, time), cutoff.mass));
    const events = orbitalEvents(orbit);
    const apoEvent = events.find(e => e.kind === 'apoapsis');
    const periEvent = events.find(e => e.kind === 'periapsis');
    const apoapsisTime = apoEvent ? apoEvent.time : orbit.initial.time + orbit.period / 2;
    const apoapsisPoint = fromCoastBody(sampleOrbitalCoast(orbit, apoapsisTime), cutoff.mass);
    const periapsisPoint = periEvent
      ? fromCoastBody(sampleOrbitalCoast(orbit, periEvent.time), cutoff.mass)
      : lowestFrame(coast);
    return {
      coast,
      outcome: 'orbit',
      eccentricity: orbit.e,
      periapsis: orbit.periapsisAltitude / RADIUS,
      apoapsis: orbit.apoapsisAltitude / RADIUS,
      periapsisPoint,
      apoapsisTime,
      apoapsisPoint,
      orbit,
      ballistic: null,
    };
  }

  const ballistic = planBallisticCoast(initial, RADIUS);
  const coast = ballistic ? sampleBallisticArc(ballistic, cutoff.time, ballistic.endTime, cutoff.mass) : [];
  const outcome = classification.kind === 'escape' ? 'escape' : 'returning';
  const hasFutureApex = Boolean(ballistic && ballistic.outcome === 'impact' && ballistic.apexTime !== null && ballistic.apexTime > cutoff.time);
  const apoapsisTime = hasFutureApex ? ballistic!.apexTime! : null;
  const apoapsisPoint = apoapsisTime !== null && ballistic
    ? fromCoastBody(sampleBallisticCoast(ballistic, apoapsisTime), cutoff.mass)
    : null;
  const apoapsis = apoapsisPoint
    ? Math.hypot(apoapsisPoint.x, apoapsisPoint.y) - 1
    : outcome === 'returning'
      ? Math.hypot(cutoff.x, cutoff.y) - 1
      : null;

  return {
    coast,
    outcome,
    eccentricity: ballistic ? ballistic.eccentricity : null,
    periapsis: classification.periapsisAltitude === null ? null : classification.periapsisAltitude / RADIUS,
    apoapsis,
    periapsisPoint: null,
    apoapsisTime,
    apoapsisPoint,
    orbit: null,
    ballistic,
  };
}

function computeCirculariseBurn(cutoffMass: number, apoapsisPoint: TurnFrame | null): number | null {
  if (!apoapsisPoint) return null;
  const ra = Math.hypot(apoapsisPoint.x, apoapsisPoint.y);
  if (ra <= 1.002) return null;
  const sideways = (apoapsisPoint.y * apoapsisPoint.vx - apoapsisPoint.x * apoapsisPoint.vy) / ra;
  if (sideways <= 1e-5) return null;
  const vc = Math.sqrt(1 / ra);
  const va = Math.hypot(apoapsisPoint.vx, apoapsisPoint.vy);
  const dv = Math.max(0, vc - va);
  if (dv < 1e-5) return 0;
  const veff = INITIAL_THRUST_ACCELERATION / MASS_FLOW;
  const dt = (cutoffMass / MASS_FLOW) * (1 - Math.exp(-dv / veff));
  const maxAvailable = Math.max(0, (cutoffMass - MIN_DRY_MASS) / MASS_FLOW);
  if (dt > maxAvailable || dt > TURN_MAX_KICK) return null;
  return Math.round(dt * 10000) / 10000;
}

export function gravityTurnFlight(settings: TurnSettings): TurnFlight {
  let frame: TurnFrame = { time: 0, x: 0, y: 1, vx: 0, vy: 0, mass: 1 };
  const ascent = [frame];
  const steps = Math.round(settings.burn / STEP);
  for (let i = 1; i <= steps; i++) {
    const next = advance(frame, STEP);
    if (Math.hypot(next.x, next.y) < 1) {
      const cutoff = surfaceContact(frame, next);
      ascent.push(cutoff);
      return {
        ascent, transfer: [], kickArc: [], coast: [], unburnedCoast: [],
        cutoff, kickCutoff: null, outcome: 'powered-impact', circular: false,
        eccentricity: null, periapsis: null, apoapsis: null,
        apoapsisPoint: null, periapsisPoint: null, circulariseBurn: null,
      };
    }
    if (i === Math.round(TURN_PITCH_TIME / STEP)) {
      const angle = settings.pitch * Math.PI / 180;
      // Treat the brief pitch-over as a rotation of the initial velocity.
      next.vx = next.vy * Math.sin(angle);
      next.vy *= Math.cos(angle);
    }
    frame = next;
    ascent.push(frame);
  }

  const cutoff = frame;
  const firstCoast = evaluateCoast(cutoff);
  const circulariseBurn = computeCirculariseBurn(cutoff.mass, firstCoast.apoapsisPoint);
  const requestedKick = Math.max(0, settings.kickBurn ?? 0);
  const maxKick = Math.max(0, (cutoff.mass - MIN_DRY_MASS) / MASS_FLOW);
  const actualKick = Math.min(requestedKick, maxKick);

  if (actualKick <= 1e-6 || firstCoast.apoapsisTime === null) {
    const circular = firstCoast.outcome === 'orbit' && firstCoast.eccentricity !== null && firstCoast.eccentricity < 0.015;
    return {
      ascent,
      transfer: [],
      kickArc: [],
      coast: firstCoast.coast,
      unburnedCoast: [],
      cutoff,
      kickCutoff: null,
      outcome: firstCoast.outcome,
      circular,
      eccentricity: firstCoast.eccentricity,
      periapsis: firstCoast.periapsis,
      apoapsis: firstCoast.apoapsis,
      apoapsisPoint: firstCoast.apoapsisPoint,
      periapsisPoint: firstCoast.periapsisPoint,
      circulariseBurn,
    };
  }

  // Straddle the finite second burn across apoapsis so radial components before
  // and after the peak cancel cleanly, matching real orbital circularisation.
  const kickStart = Math.max(cutoff.time, firstCoast.apoapsisTime - actualKick / 2);
  const transfer = kickStart <= cutoff.time + 1e-7
    ? [cutoff]
    : firstCoast.orbit
      ? sampleOrbitalArc(firstCoast.orbit, cutoff.time, kickStart, cutoff.mass)
      : sampleBallisticArc(firstCoast.ballistic!, cutoff.time, kickStart, cutoff.mass, 161);

  let burnFrame = transfer[transfer.length - 1];
  const kickArc = [burnFrame];
  const kickSteps = Math.max(8, Math.ceil(actualKick / KICK_STEP));
  const kickDt = actualKick / kickSteps;
  for (let i = 1; i <= kickSteps; i++) {
    const next = advance(burnFrame, kickDt);
    if (Math.hypot(next.x, next.y) < 1) {
      const impact = surfaceContact(burnFrame, next);
      kickArc.push(impact);
      return {
        ascent,
        transfer,
        kickArc,
        coast: [],
        unburnedCoast: firstCoast.coast,
        cutoff,
        kickCutoff: impact,
        outcome: 'powered-impact',
        circular: false,
        eccentricity: null,
        periapsis: null,
        apoapsis: firstCoast.apoapsis,
        apoapsisPoint: firstCoast.apoapsisPoint,
        periapsisPoint: null,
        circulariseBurn,
      };
    }
    burnFrame = next;
    kickArc.push(burnFrame);
  }

  const secondCoast = evaluateCoast(burnFrame);
  const circular = secondCoast.outcome === 'orbit' && secondCoast.eccentricity !== null && secondCoast.eccentricity < 0.015;
  return {
    ascent,
    transfer,
    kickArc,
    coast: secondCoast.coast,
    unburnedCoast: firstCoast.coast,
    cutoff,
    kickCutoff: burnFrame,
    outcome: secondCoast.outcome,
    circular,
    eccentricity: secondCoast.eccentricity,
    periapsis: secondCoast.periapsis,
    apoapsis: secondCoast.apoapsis,
    apoapsisPoint: firstCoast.apoapsisPoint,
    periapsisPoint: secondCoast.periapsisPoint,
    circulariseBurn,
  };
}

export function turnTelemetry({ x, y, vx, vy }: TurnFrame) {
  const radius = Math.hypot(x, y);
  const radial = (x * vx + y * vy) / radius;
  const sideways = (y * vx - x * vy) / radius;
  return {
    altitude: radius - 1,
    angle: Math.hypot(vx, vy) > 0 ? Math.atan2(radial, sideways) * 180 / Math.PI : null,
    speedRatio: Math.hypot(vx, vy) * Math.sqrt(radius),
    sidewaysRatio: sideways * Math.sqrt(radius),
  };
}
