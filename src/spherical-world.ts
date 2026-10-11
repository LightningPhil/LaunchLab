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

export type WorldView = 'flight' | 'horizon' | 'world';
export interface SurfacePoint { x: number; y: number }

/** An undistorted view: both axes use the same metres-per-pixel scale. Include
 * the live vehicle so a high flight cannot disappear beyond the world view. */
export function worldViewFrame(mode: Exclude<WorldView, 'flight'>, radius: number,
  width: number, height: number, focus: SurfacePoint, launchX: number, contextRadius = 1.22) {
  const launch = surfacePosition(launchX, 0, radius);
  const vehicle = surfacePosition(focus.x, focus.y, radius);
  const extent = mode === 'world'
    ? { minX: -radius * contextRadius, maxX: radius * contextRadius,
      minY: -radius * (1 + contextRadius), maxY: radius * (contextRadius - 1) }
    : { minX: launch.x - radius * .7, maxX: launch.x + radius * .7,
      minY: launch.y - radius * .3, maxY: launch.y + radius * .32 };
  extent.minX = Math.min(extent.minX, vehicle.x - radius * .06);
  extent.maxX = Math.max(extent.maxX, vehicle.x + radius * .06);
  extent.minY = Math.min(extent.minY, vehicle.y - radius * .06);
  extent.maxY = Math.max(extent.maxY, vehicle.y + radius * .06);
  const margin = 24;
  const ppm = Math.max(1e-10, Math.min((Math.max(1, width - margin * 2)) / (extent.maxX - extent.minX),
    (Math.max(1, height - margin * 2)) / (extent.maxY - extent.minY)));
  return { ppm, originX: width / 2 - (extent.minX + extent.maxX) / 2 * ppm,
    originY: height / 2 + (extent.minY + extent.maxY) / 2 * ppm };
}
