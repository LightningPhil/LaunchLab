import { classifyTrajectory } from './environment.ts';

const TAU = 2 * Math.PI;
const wrap = (angle: number) => angle - TAU * Math.floor((angle + Math.PI) / TAU);

/** Elliptic two-body motion after engine cutoff. The orbital plane is the
 * existing flight plane; no camera coordinates enter the physical solution. */
export function planOrbitalCoast(initial: any, gravity: number) {
  const info = classifyTrajectory(initial, gravity);
  if (initial.engineOn || initial.outcome !== 'flight' || info.kind !== 'orbit') return null;
  const R = initial.planetRadius, mu = gravity * R * R;
  const { wx: x, wy: y, wvx: vx, wvy: vy } = initial;
  const r = Math.hypot(x, y), h = x * vy - y * vx;
  const a = -mu / (2 * info.specificEnergy!);
  const ex = vy * h / mu - x / r, ey = -vx * h / mu - y / r;
  const eccentricity = Math.hypot(ex, ey);
  if (!(eccentricity < 1) || !Number.isFinite(info.period)) return null;
  // A circular orbit has no distinguished periapsis. Use the initial radius
  // as its axis rather than normalising an almost-zero eccentricity vector.
  const e = eccentricity < 1e-12 ? 0 : eccentricity;
  const ux = e ? ex / eccentricity : x / r, uy = e ? ey / eccentricity : y / r;
  const direction = h < 0 ? -1 : 1;
  const q = h * h / (mu * (1 + e));
  const b = Math.abs(h) * Math.sqrt(a / mu);
  const initialE = e ? Math.atan2((x * -uy + y * ux) * direction / b,
    (x * ux + y * uy) / a + e) : 0;
  const initialM = initialE - e * Math.sin(initialE);
  const initialTrue = Math.atan2((x * -uy + y * ux) * direction, x * ux + y * uy);
  const period = info.period!;
  return { initial: { ...initial }, mu, a, b, q, e, ux, uy, direction, h,
    initialE, initialM, initialTrue, period,
    periapsisAltitude: q - R, apoapsisAltitude: a * (1 + e) - R,
    endTime: initial.time + period };
}
export type OrbitalCoast = NonNullable<ReturnType<typeof planOrbitalCoast>>;

function eccentricAnomaly(mean: number, e: number) {
  let lo = -Math.PI, hi = Math.PI, anomaly = mean;
  // Bracketed Newton remains reliable for highly eccentric ellipses too.
  for (let i = 0; i < 60; i++) {
    const error = anomaly - e * Math.sin(anomaly) - mean;
    if (Math.abs(error) < 1e-14) break;
    if (error > 0) hi = anomaly; else lo = anomaly;
    const next = anomaly - error / (1 - e * Math.cos(anomaly));
    anomaly = next > lo && next < hi ? next : (lo + hi) / 2;
  }
  return anomaly;
}

export function sampleOrbitalCoast(plan: OrbitalCoast, time: number) {
  const start = plan.initial;
  if (time <= start.time) return { ...start };
  const mean = plan.initialM + (time - start.time) / plan.period * TAU;
  const wrapped = wrap(mean), cycles = Math.round((mean - wrapped) / TAU);
  const E = eccentricAnomaly(wrapped, plan.e), sinE = Math.sin(E), cosE = Math.cos(E);
  const sagitta = 2 * plan.a * Math.sin(E / 2) ** 2;
  const px = plan.q - sagitta, py = plan.b * sinE, r = plan.q + plan.e * sagitta;
  const vx = -Math.sqrt(plan.mu * plan.a) * sinE / r, vy = Math.abs(plan.h) * cosE / r;
  const tx = -plan.uy * plan.direction, ty = plan.ux * plan.direction;
  const wx = plan.ux * px + tx * py, wy = plan.uy * px + ty * py;
  const wvx = plan.ux * vx + tx * vy, wvy = plan.uy * vx + ty * vy;
  const angle = Math.atan2(py, px) + cycles * TAU;
  const longitude = start.x / start.planetRadius - plan.direction * (angle - plan.initialTrue);
  return { ...start, time, x: longitude * start.planetRadius, y: r - start.planetRadius,
    wx, wy, wvx, wvy, vx: (wvx * wy - wvy * wx) / r, vy: (wvx * wx + wvy * wy) / r };
}

/** Uniform eccentric-anomaly sampling resolves the fast turn near periapsis
 * without making recordings proportional to their duration. */
export function orbitalSampleTimes(plan: OrbitalCoast, lap = 0) {
  return Array.from({ length: 721 }, (_, i) => {
    const E = plan.initialE + TAU * i / 720;
    return plan.initial.time + (lap + (E - plan.e * Math.sin(E) - plan.initialM) / TAU) * plan.period;
  });
}

export function orbitalEvents(plan: OrbitalCoast) {
  if (plan.e < 1e-6) return [];
  return [[0, 'periapsis', 'Lowest orbital point'], [Math.PI, 'apoapsis', 'Highest orbital point']].map(([mean, kind, label]) => ({
    time: plan.initial.time + (((Number(mean) - plan.initialM) % TAU + TAU) % TAU) / TAU * plan.period,
    kind: String(kind), label: String(label),
  }));
}
