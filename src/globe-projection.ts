/** Sizes are capped independently of zoom: huge surface arcs must never create
 * canvases the size of the planet. Each source map wraps a whole circumference. */
export function globeSize(textureWidth: number): number {
  return Math.min(2048, Math.max(256, 2 ** Math.ceil(Math.log2(textureWidth / Math.PI))));
}

/** Input is the middle half of the equirectangular map (the visible hemisphere).
 * Bake a few rows at a time so the caller can yield to animation and input. */
export function projectGlobeRows(
  pixels: Uint8ClampedArray, width: number, height: number,
  output: Uint8ClampedArray, size: number, start: number, end: number, sun: boolean,
) {
  for (let y = start; y < end; y++) for (let x = 0; x < size; x++) {
    const nx = (x + .5) * 2 / size - 1, ny = (y + .5) * 2 / size - 1;
    const square = nx * nx + ny * ny;
    if (square >= 1) continue;
    const nz = Math.sqrt(1 - square);
    const u = (.5 + Math.atan2(nx, nz) / Math.PI) * (width - 1);
    const v = (.5 + Math.asin(ny) / Math.PI) * (height - 1);
    const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
    const light = sun ? .68 + .32 * nz : .25 + .78 * Math.max(0, -.4 * nx - .4 * ny + .8246 * nz);
    const index = (y * size + x) * 4;
    const a = (iy * width + ix % width) * 4, b = (iy * width + (ix + 1) % width) * 4;
    const c = (Math.min(height - 1, iy + 1) * width + ix % width) * 4;
    const d = (Math.min(height - 1, iy + 1) * width + (ix + 1) % width) * 4;
    for (let channel = 0; channel < 3; channel++) {
      const upper = pixels[a + channel] * (1 - fx) + pixels[b + channel] * fx;
      const lower = pixels[c + channel] * (1 - fx) + pixels[d + channel] * fx;
      output[index + channel] = (upper * (1 - fy) + lower * fy) * light;
    }
    output[index + 3] = Math.min(1, (1 - Math.sqrt(square)) * size / 2) * 255;
  }
}
