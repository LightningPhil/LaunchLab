export interface HorizonPoint { x: number; y: number }

/** A small coordinate frame on a very large circle. Never send planet-sized
 * coordinates to Canvas: its rasterizer can round those to tens of pixels. */
export function localHorizon(cx: number, cy: number, radius: number, width: number, height: number) {
  const extent = Math.hypot(width, height) + 32;
  const middle = { x: width / 2, y: height / 2 };
  const dx = middle.x - cx, dy = middle.y - cy;
  const distance = Math.hypot(dx, dy);
  const normal = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: -1 };
  const offset = distance - radius;
  const surface = { x: middle.x - normal.x * offset, y: middle.y - normal.y * offset };
  return { radius, width, height, extent, middle, normal, offset, surface };
}

export type LocalHorizon = ReturnType<typeof localHorizon>;

/** Stable circle sagitta, measured from the nearby tangent, including layers
 * a few pixels beneath the surface. No subtraction of two enormous radii. */
export function horizonPoint(h: LocalHorizon, along: number, depth = 0): HorizonPoint {
  const r = h.radius - depth;
  const sagitta = along * along / (r + Math.sqrt((r - along) * (r + along)));
  return {
    x: h.surface.x - h.normal.y * along - h.normal.x * (depth + sagitta),
    y: h.surface.y + h.normal.x * along - h.normal.y * (depth + sagitta),
  };
}

/** Append the visible disc to a path. Called only for R > 16 viewport diagonals.
 * Quadratic pieces interpolate exact circle endpoints/midpoints; their error
 * is far below a physical pixel, even at the threshold and high display zoom.
 * The closing edges stay outside the viewport, with bounded coordinates. */
export function traceLocalDisc(ctx: CanvasRenderingContext2D, h: LocalHorizon, depth = 0) {
  const offset = h.offset + depth;
  if (offset > h.extent / 2) return;
  if (offset < -h.extent / 2) {
    ctx.rect(0, 0, h.width, h.height);
    return;
  }
  const count = Math.ceil(2 * h.extent / 128);
  let start = horizonPoint(h, -h.extent, depth);
  ctx.moveTo(start.x, start.y);
  for (let i = 1; i <= count; i++) {
    const end = horizonPoint(h, -h.extent + 2 * h.extent * i / count, depth);
    const middle = horizonPoint(h, -h.extent + 2 * h.extent * (i - .5) / count, depth);
    ctx.quadraticCurveTo(2 * middle.x - (start.x + end.x) / 2,
      2 * middle.y - (start.y + end.y) / 2, end.x, end.y);
    start = end;
  }
  ctx.lineTo(start.x - h.normal.x * h.extent * 3, start.y - h.normal.y * h.extent * 3);
  const first = horizonPoint(h, -h.extent, depth);
  ctx.lineTo(first.x - h.normal.x * h.extent * 3, first.y - h.normal.y * h.extent * 3);
  ctx.closePath();
}
