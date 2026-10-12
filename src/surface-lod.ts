/** Shared by the 2D flight globe and the 3D orrery. Input is physical pixels,
 * including display scaling / devicePixelRatio, not CSS pixels. */
export function surfaceLevel(pixels: number, previous = 0, levels = 3): number {
  if (!(pixels > 0)) return 0;
  if (levels > 2 && pixels > (previous === 2 ? 384 : 512)) return 2;
  return levels > 1 && pixels > (previous >= 1 ? 64 : 96) ? 1 : 0;
}

/** Keep a usable surface during asynchronous upgrades, with bounded residency.
 * A loader must honour cancellation before doing expensive CPU work. */
export class SurfaceLod<T> {
  private resources: (T | undefined)[] = [];
  private requests = new Map<number, object>();
  private failed = new Set<number>();
  private lastUse: number[] = [];
  private desired = 0;
  private changedAt = 0;
  private now = 0;
  private levels: number;
  private load: (level: number, cancelled: () => boolean) => Promise<T>;
  private dispose: (resource: T) => void;
  constructor(
    levels: number,
    load: (level: number, cancelled: () => boolean) => Promise<T>,
    dispose: (resource: T) => void,
  ) { this.levels = levels; this.load = load; this.dispose = dispose; }
  update(pixels: number, now: number): T | undefined {
    this.now = now;
    const next = surfaceLevel(pixels, this.desired, this.levels);
    if (next !== this.desired) { this.desired = next; this.changedAt = now; }
    this.request(0);
    for (let level = 1; level <= this.desired; level++) {
      this.lastUse[level] = now;
      // Avoid an 8K decode for a momentary fly-past / zoom gesture.
      if (level < 2 || now - this.changedAt >= 300) this.request(level);
    }
    for (let level = this.desired + 1; level < this.levels; level++) {
      if (now - (this.lastUse[level] ?? 0) > 15000) this.release(level);
    }
    for (let level = this.desired; level >= 0; level--) {
      if (this.resources[level]) return this.resources[level];
    }
    // Even if the overview failed, do not blank a previously loaded globe.
    return this.resources.find(Boolean);
  }
  private request(level: number) {
    if (this.resources[level] || this.requests.has(level) || this.failed.has(level)) return;
    const token = {};
    this.requests.set(level, token);
    const cancelled = () => this.requests.get(level) !== token;
    this.load(level, cancelled).then(resource => {
      if (cancelled()) { this.dispose(resource); return; }
      this.requests.delete(level);
      this.resources[level] = resource;
      this.lastUse[level] = this.now;
    }, () => {
      if (cancelled()) return;
      this.requests.delete(level); this.failed.add(level);
    });
  }
  private release(level: number) {
    this.requests.delete(level);
    if (this.resources[level]) this.dispose(this.resources[level]!);
    this.resources[level] = undefined;
  }
  /** Hidden dialogs / inactive worlds need not retain their large maps. */
  releaseDetails() {
    for (let level = 1; level < this.levels; level++) this.release(level);
    this.desired = 0;
  }
  disposeAll() {
    this.releaseDetails(); this.release(0);
  }
}
