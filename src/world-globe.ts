import { WORLD_MAPS } from './world-textures.ts';

// Bake the existing illustrated maps onto an orthographic sphere once per world.
// This keeps the launch scene on its lightweight 2D canvas, including offline.
const globes = new Map<string, HTMLCanvasElement | null>();
export function worldGlobe(name: string): HTMLCanvasElement | null {
  if (globes.has(name)) return globes.get(name)!;
  if (typeof document === 'undefined' || typeof Image === 'undefined' || !WORLD_MAPS[name]) return null;
  globes.set(name, null);
  const image = new Image();
  image.onload = () => {
    try {
      const source = document.createElement('canvas');
      source.width = image.naturalWidth; source.height = image.naturalHeight;
      const sourceContext = source.getContext('2d', { willReadFrequently: true })!;
      sourceContext.drawImage(image, 0, 0);
      const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
      const globe = document.createElement('canvas');
      globe.width = globe.height = 640;
      const context = globe.getContext('2d')!;
      const result = context.createImageData(globe.width, globe.height);
      for (let y = 0; y < globe.height; y++) for (let x = 0; x < globe.width; x++) {
        const nx = (x + .5) * 2 / globe.width - 1, ny = (y + .5) * 2 / globe.height - 1;
        const square = nx * nx + ny * ny;
        if (square >= 1) continue;
        const nz = Math.sqrt(1 - square);
        const u = (.5 + Math.atan2(nx, nz) / (Math.PI * 2)) * source.width;
        const v = (.5 + Math.asin(ny) / Math.PI) * (source.height - 1);
        const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
        const light = name === 'sun' ? .68 + .32 * nz
          : .25 + .78 * Math.max(0, -.4 * nx - .4 * ny + .8246 * nz);
        const output = (y * globe.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const sample = (sx: number, sy: number) => pixels[(Math.min(source.height - 1, sy) * source.width + sx % source.width) * 4 + channel];
          const upper = sample(ix, iy) * (1 - fx) + sample(ix + 1, iy) * fx;
          const lower = sample(ix, iy + 1) * (1 - fx) + sample(ix + 1, iy + 1) * fx;
          result.data[output + channel] = (upper * (1 - fy) + lower * fy) * light;
        }
        result.data[output + 3] = Math.min(1, (1 - Math.sqrt(square)) * globe.width / 2) * 255;
      }
      context.putImageData(result, 0, 0); globes.set(name, globe);
    } catch { /* The procedural sphere remains usable if an image cannot load. */ }
  };
  image.src = WORLD_MAPS[name].overview;
  return null;
}
