/** Metres in the flight plane, with the launch meridian at the top of the world.
 * The centre is (0, -radius). This form retains centimetre-scale precision at
 * the surface instead of subtracting two planetary radii. */
export function surfacePosition(x: number, altitude: number, radius: number) {
  if (!(radius > 0)) return { x, y: altitude };
  const angle = x / radius;
  return { x: (radius + altitude) * Math.sin(angle),
    y: altitude * Math.cos(angle) - 2 * radius * Math.sin(angle / 2) ** 2 };
}

/** Newtonian gravity outside a spherical world; x/y are centre-relative.
 * Reference: https://nescacademy.nasa.gov/flightsim/2015/gravity */
export function radialGravity(x: number, y: number, radius: number, surfaceGravity: number) {
  const distance = Math.max(1, Math.hypot(x, y));
  const factor = -surfaceGravity * (radius / distance) ** 2 / distance;
  return { x: factor * x, y: factor * y };
}

export function gravityAtAltitude(radius: number, surfaceGravity: number, altitude: number) {
  return surfaceGravity * (radius / Math.max(radius, radius + altitude)) ** 2;
}

export interface SurfacePoint { x: number; y: number }
