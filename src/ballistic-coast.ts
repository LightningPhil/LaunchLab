/** Unpowered two-body motion, parameterised from periapsis. This avoids stepping
 * through millions of seconds on a nearly escaping ellipse. The universal
 * anomaly also handles hyperbolic and exactly parabolic departures.
 * Kepler equations: https://docs.poliastro.space/en/stable/autoapi/poliastro/core/angles/index.html
 */
export const ESCAPE_CENTRE_RADII = 10;
export type BallisticCoast = {
  initial: any; mu: number; alpha: number; q: number; eccentricity: number;
  angularMomentum: number; ux: number; uy: number; direction: number;
  initialAnomaly: number; initialPeriTime: number; endAnomaly: number; endPeriTime: number;
  endTime: number; apexTime: number | null; apexHeight: number | null;
  outcome: 'impact' | 'escape';
};

function stumpff(z: number) {
  if (Math.abs(z) < .01) {
    // Series retain precision at escape energy, where both direct expressions
    // subtract almost equal numbers. Six terms suffice throughout this branch.
    let c = .5, s = 1 / 6, ct = c, st = s;
    for (let k = 1; k <= 6; k++) {
      ct *= -z / ((2 * k + 1) * (2 * k + 2));
      st *= -z / ((2 * k + 2) * (2 * k + 3)); c += ct; s += st;
    }
    return { c, s };
  }
  const root = Math.sqrt(Math.abs(z));
  return z > 0 ? { c: 2 * Math.sin(root / 2) ** 2 / z, s: (root - Math.sin(root)) / root ** 3 }
    : { c: 2 * Math.sinh(root / 2) ** 2 / -z, s: (Math.sinh(root) - root) / root ** 3 };
}

function anomalyAtRadius(radius: number, q: number, e: number, alpha: number) {
  const d = Math.max(0, (radius - q) / e);
  if (alpha > 0) return 2 * Math.asin(Math.sqrt(Math.min(1, d * alpha / 2))) / Math.sqrt(alpha);
  if (alpha < 0) return 2 * Math.asinh(Math.sqrt(d * -alpha / 2)) / Math.sqrt(-alpha);
  return Math.sqrt(2 * d);
}

function periTime(plan: Pick<BallisticCoast, 'q' | 'eccentricity' | 'alpha' | 'mu'>, u: number) {
  return (plan.q * u + plan.eccentricity * u ** 3 * stumpff(plan.alpha * u * u).s) / Math.sqrt(plan.mu);
}

/** Safe orbits are handled separately by the rocket orbital coast solver.
 * Returning conics must actually intersect the surface; speed alone is not
 * sufficient to infer a landing from an arbitrary airborne rocket state. */
export function planBallisticCoast(initial: any, gravity: number): BallisticCoast | null {
  const R = initial.planetRadius;
  if (!(R > 0) || !(gravity > 0) || initial.engineOn || initial.outcome !== 'flight') return null;
  const { wx: x, wy: y, wvx: vx, wvy: vy } = initial;
  const r = Math.hypot(x, y), mu = gravity * R * R, v2 = vx * vx + vy * vy;
  if (![r, v2].every(Number.isFinite) || r < R - .001) return null;
  const dot = x * vx + y * vy, h = x * vy - y * vx;
  const energy = v2 / 2 - mu / r, alpha = -2 * energy / mu;
  const eccentricity = Math.sqrt(Math.max(0, 1 - alpha * h * h / mu));
  const q = h * h / (mu * (1 + eccentricity));
  const escaping = energy >= 0;
  if ((escaping && dot <= 0) || (!escaping && q > R)) return null;
  const ex = (v2 - mu / r) * x - dot * vx, ey = (v2 - mu / r) * y - dot * vy;
  const eLength = Math.hypot(ex, ey);
  if (!(eLength > 0) || !(eccentricity > 0)) return null;
  const plan: BallisticCoast = { initial: { ...initial }, mu, alpha, q, eccentricity,
    angularMomentum: h, ux: ex / eLength, uy: ey / eLength, direction: h < 0 ? -1 : 1,
    initialAnomaly: anomalyAtRadius(r, q, eccentricity, alpha) * (dot < 0 ? -1 : 1),
    initialPeriTime: 0, endAnomaly: 0, endPeriTime: 0, endTime: 0,
    apexTime: null, apexHeight: null, outcome: escaping ? 'escape' : 'impact' };
  plan.initialPeriTime = periTime(plan, plan.initialAnomaly);
  if (escaping) {
    // An already distant engine cutoff still gets a visible onward journey.
    plan.endAnomaly = anomalyAtRadius(Math.max(R * ESCAPE_CENTRE_RADII, r * 2), q, eccentricity, alpha);
    plan.endPeriTime = periTime(plan, plan.endAnomaly);
    plan.endTime = initial.time + plan.endPeriTime - plan.initialPeriTime;
  } else {
    plan.endAnomaly = -anomalyAtRadius(R, q, eccentricity, alpha);
    plan.endPeriTime = periTime(plan, plan.endAnomaly);
    const period = 2 * Math.PI / Math.sqrt(mu * alpha ** 3);
    plan.endTime = initial.time + (dot >= 0 ? period : 0) + plan.endPeriTime - plan.initialPeriTime;
    if (dot > 0) {
      plan.apexTime = initial.time + period / 2 - plan.initialPeriTime;
      plan.apexHeight = 2 / alpha - q - R;
    }
  }
  return Number.isFinite(plan.endTime) && plan.endTime > initial.time ? plan : null;
}

function geometry(plan: BallisticCoast, u: number) {
  const z = plan.alpha * u * u, { c, s } = stumpff(z);
  const sinTerm = u * (1 - z * s), px = plan.q - u * u * c;
  const py = Math.abs(plan.angularMomentum) / Math.sqrt(plan.mu) * sinTerm;
  const radius = plan.q + plan.eccentricity * u * u * c;
  return { px, py, radius, vx: -Math.sqrt(plan.mu) * sinTerm / radius,
    vy: Math.abs(plan.angularMomentum) * (1 - z * c) / radius };
}

export function sampleBallisticCoast(plan: BallisticCoast, time: number): any {
  const initial = plan.initial;
  if (time <= initial.time) return { ...initial };
  time = Math.min(time, plan.endTime);
  const inbound = plan.outcome === 'impact' && (plan.apexTime === null || time >= plan.apexTime);
  // Measure the inbound phase from impact, not a subtraction of two almost
  // equal orbital periods. Contact remains accurate even on multi-year flights.
  const target = inbound ? -plan.endPeriTime + (plan.endTime - time)
    : plan.initialPeriTime + (time - initial.time);
  let lo = 0, hi = plan.alpha > 0 ? Math.PI / Math.sqrt(plan.alpha) : plan.endAnomaly;
  for (let i = 0; i < 75; i++) {
    const mid = (lo + hi) / 2;
    if (periTime(plan, mid) < target) lo = mid; else hi = mid;
  }
  const u = time === plan.endTime ? plan.endAnomaly : (lo + hi) / 2 * (inbound ? -1 : 1);
  const p = geometry(plan, u), start = geometry(plan, plan.initialAnomaly);
  const R = initial.planetRadius, direction = plan.direction;
  const vxAxis = -plan.uy * direction, vyAxis = plan.ux * direction;
  const wx = plan.ux * p.px + vxAxis * p.py, wy = plan.uy * p.px + vyAxis * p.py;
  const wvx = plan.ux * p.vx + vxAxis * p.vy, wvy = plan.uy * p.vx + vyAxis * p.vy;
  const angle = (point: { px: number; py: number }, incoming: boolean) => {
    const a = Math.atan2(point.py, point.px); return incoming && a < 0 ? a + 2 * Math.PI : a;
  };
  const longitude = initial.x / R - direction * (angle(p, inbound) - angle(start, plan.initialAnomaly < 0));
  const next = { ...initial, time, x: longitude * R, y: Math.max(0, p.radius - R), wx, wy, wvx, wvy,
    vx: (wvx * wy - wvy * wx) / p.radius, vy: (wvx * wx + wvy * wy) / p.radius };
  if (plan.apexTime !== null && time >= plan.apexTime) {
    next.apexTime = plan.apexTime; next.apexHeight = plan.apexHeight;
    if (time === plan.apexTime) next.vy = 0;
  }
  if (time === plan.endTime && plan.outcome === 'impact') {
    Object.assign(next, { outcome: 'impact', y: 0, wx: R * Math.sin(longitude), wy: R * Math.cos(longitude),
      impactTime: time, impactSpeed: Math.hypot(next.vx, next.vy), impactVx: next.vx, impactVy: next.vy,
      vx: 0, vy: 0, wvx: 0, wvy: 0 });
  }
  return next;
}
