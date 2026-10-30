import { WORLD_MAPS } from './world-textures.ts';
import { SurfaceLod } from './surface-lod.ts';
import { globeSize, projectGlobeRows } from './globe-projection.ts';

// Serialise large image decodes / projections, including rapid world changes.
// The renderer keeps the previous resolution while an upgrade is in progress.
// These opaque colour layers deliberately have no baked silhouette: the live
// vector circle in renderer.ts owns the planet's edge at every zoom level.
let bakeQueue: Promise<unknown> = Promise.resolve();
const globes = new Map<string, { surface: SurfaceLod<HTMLCanvasElement>; lastUse: number }>();
const release = (canvas: HTMLCanvasElement) => { canvas.width = canvas.height = 1; };
const yieldFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function bake(name: string, level: number, cancelled: () => boolean): Promise<HTMLCanvasElement> {
  if (cancelled()) throw new Error('Obsolete globe');
  const image = new Image();
  image.decoding = 'async';
  image.src = WORLD_MAPS[name][level].url;
  await image.decode();
  if (cancelled()) { image.src = ''; throw new Error('Obsolete globe'); }
  const source = document.createElement('canvas');
  const size = globeSize(image.naturalWidth);
  // Decode once, then discard the source canvas and image before projecting.
  source.width = image.naturalWidth / 2; source.height = image.naturalHeight;
  const sourceContext = source.getContext('2d', { willReadFrequently: true })!;
  sourceContext.drawImage(image, image.naturalWidth / 4, 0, source.width, source.height,
    0, 0, source.width, source.height);
  const { width, height } = source;
  const pixels = sourceContext.getImageData(0, 0, width, height).data;
  release(source); image.src = '';
  const globe = document.createElement('canvas');
  globe.width = globe.height = size;
  const context = globe.getContext('2d')!;
  const result = context.createImageData(size, size);
  let row = 0;
  while (row < size) {
    if (cancelled()) { release(globe); throw new Error('Obsolete globe'); }
    const started = performance.now();
    do {
      const end = Math.min(size, row + 8);
      projectGlobeRows(pixels, width, height, result.data, size, row, end, name === 'sun');
      row = end;
    } while (row < size && performance.now() - started < 4);
    if (row < size) await yieldFrame();
  }
  context.putImageData(result, 0, 0);
  return globe;
}

/** Diameter in physical pixels, so OS zoom and Retina screens get sharp maps. */
export function worldGlobe(name: string, pixels: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || !WORLD_MAPS[name]) return null;
  const now = performance.now();
  for (const [key, entry] of globes) {
    if (now - entry.lastUse > 15000) { entry.surface.disposeAll(); globes.delete(key); }
  }
  let entry = globes.get(name);
  if (!entry) {
    if (globes.size >= 3) {
      const oldest = [...globes].sort((a, b) => a[1].lastUse - b[1].lastUse)[0];
      oldest[1].surface.disposeAll(); globes.delete(oldest[0]);
    }
    const surface = new SurfaceLod<HTMLCanvasElement>(WORLD_MAPS[name].length, (level, cancelled) => {
      const job = bakeQueue.then(() => bake(name, level, cancelled));
      bakeQueue = job.catch(() => {});
      return job;
    }, release);
    entry = { surface, lastUse: now }; globes.set(name, entry);
  }
  entry.lastUse = now;
  return entry.surface.update(pixels, now) ?? null;
}
