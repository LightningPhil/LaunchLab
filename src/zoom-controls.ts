import './zoom-controls.css';
import { Renderer } from './renderer.ts';
import type { FlightRecord } from './flight.ts';
import type { SurfacePoint } from './spherical-world.ts';
import type { ScreenPoint } from './inspection-camera.ts';

type Centre = 'free' | 'launch' | 'landing';

export class ZoomControls {
  private panel = document.createElement('div');
  private markers = document.createElement('div');
  private centre: Centre = 'free';
  private sites: { launch: SurfacePoint; landing: SurfacePoint | null } = { launch: { x: 1.5, y: 0 }, landing: null };
  private pointers = new Map<number, ScreenPoint>();
  private moved = false;
  private press: ScreenPoint | null = null;
  private lastManual = false;
  private canvas: HTMLCanvasElement;
  onAuto: () => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.panel.className = 'zoom-controls';
    this.panel.setAttribute('role', 'group'); this.panel.setAttribute('aria-label', 'Scene zoom');
    this.panel.innerHTML = `<div class="zoom-mode"><span>Zoom</span><button type="button" data-mode="auto" aria-pressed="true">Auto</button><button type="button" data-mode="manual" aria-pressed="false">Manual</button></div>
      <div class="zoom-tools" hidden><div class="zoom-actions"><button type="button" data-site="launch" aria-label="Centre zoom on launch site" aria-pressed="false">Launch</button><button type="button" data-site="landing" aria-label="Centre zoom on landing location" aria-pressed="false" disabled>Landing</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button></div><p class="zoom-hint">Scroll / pinch to zoom · drag to pan</p></div>`;
    this.markers.className = 'zoom-markers'; this.markers.hidden = true;
    this.markers.innerHTML = `<button type="button" data-site="launch" aria-label="Use launch site as zoom centre">⊙ Launch</button><button type="button" data-site="landing" aria-label="Use landing location as zoom centre">⊙ Landing</button>`;
    canvas.parentElement!.append(this.markers, this.panel);
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      button.onclick = () => {
        const manual = button.dataset.mode === 'manual';
        Renderer.setManualZoom(manual); this.centre = 'free'; this.releasePointers();
        if (!manual) this.onAuto();
        this.updateMode();
      };
    }
    for (const container of [this.panel, this.markers]) {
      for (const button of container.querySelectorAll<HTMLButtonElement>('[data-site]')) {
        button.onclick = () => this.selectCentre(button.dataset.site as Centre);
      }
    }
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
      button.onclick = () => this.zoom(button.dataset.zoom === 'in' ? 1.5 : 1 / 1.5, this.middle());
    }
    canvas.addEventListener('wheel', event => {
      if (!Renderer.isManualZoom()) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      this.zoom(Math.exp(-Math.max(-500, Math.min(500, event.deltaY * unit)) * .002), this.point(event));
    }, { passive: false });
    canvas.addEventListener('pointerdown', event => {
      if (!Renderer.isManualZoom() || event.button !== 0) return;
      event.preventDefault(); canvas.focus({ preventScroll: true });
      const point = this.point(event);
      if (!this.pointers.size) { this.press = point; this.moved = false; }
      this.pointers.set(event.pointerId, point); canvas.setPointerCapture(event.pointerId);
      if (this.pointers.size > 1) this.moved = true;
    });
    canvas.addEventListener('pointermove', event => {
      if (!this.pointers.has(event.pointerId)) return;
      const before = [...this.pointers.values()];
      const point = this.point(event), previous = this.pointers.get(event.pointerId)!;
      this.pointers.set(event.pointerId, point);
      if (before.length === 1) {
        if (!this.moved && this.press && Math.hypot(point.x - this.press.x, point.y - this.press.y) < 4) return;
        const start = this.moved ? previous : this.press!;
        this.moved = true; this.centre = 'free'; Renderer.panView(point.x - start.x, point.y - start.y);
      } else {
        const after = [...this.pointers.values()];
        const distance = (points: ScreenPoint[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        const middle = (points: ScreenPoint[]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
        if (distance(before) > 1) this.zoom(distance(after) / distance(before), middle(before), middle(after));
      }
    });
    const finish = (event: PointerEvent) => {
      if (!this.pointers.has(event.pointerId)) return;
      if (event.type === 'pointerup' && !this.moved) this.centre = 'free';
      this.pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      this.press = [...this.pointers.values()][0] ?? null;
    };
    canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('lostpointercapture', finish);
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', event => {
      if (!Renderer.isManualZoom()) return;
      if (['+', '=', '-', '_'].includes(event.key)) this.zoom(['+', '='].includes(event.key) ? 1.5 : 1 / 1.5, this.middle());
      else if (event.key.startsWith('Arrow')) {
        this.centre = 'free';
        Renderer.panView(event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0,
          event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0);
      } else if (event.key === 'Escape') this.centre = 'free';
      else return;
      event.preventDefault();
    });
  }
  private point(event: { clientX: number; clientY: number }) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private middle() { return { x: Renderer.getWidth() / 2, y: Renderer.getHeight() / 2 }; }
  private zoom(factor: number, from: ScreenPoint, to = from) {
    // A selected site stays in the middle even when the wheel is elsewhere.
    if (this.centre !== 'free') from = to = this.middle();
    Renderer.zoomAt(factor, from, to);
  }
  private selectCentre(centre: Centre) {
    if (this.centre === centre) { this.centre = 'free'; return; }
    const point = centre !== 'free' ? this.sites[centre] : null;
    if (!point) return;
    this.centre = centre; Renderer.centreView(Renderer.toCanvas(point.x, point.y));
  }
  private releasePointers() {
    for (const id of this.pointers.keys()) if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    this.pointers.clear(); this.press = null;
  }
  private updateMode() {
    const manual = Renderer.isManualZoom();
    this.panel.querySelector<HTMLElement>('.zoom-tools')!.hidden = !manual;
    this.markers.hidden = !manual;
    this.canvas.classList.toggle('manual-zoom', manual);
    this.panel.querySelector('[data-mode="auto"]')!.setAttribute('aria-pressed', String(!manual));
    this.panel.querySelector('[data-mode="manual"]')!.setAttribute('aria-pressed', String(manual));
    if (!manual) { this.centre = 'free'; this.releasePointers(); }
    this.lastManual = manual;
  }
  update(run: FlightRecord | null, launch: SurfacePoint) {
    this.sites = { launch: run ? { x: run.launchX, y: 0 } : launch,
      landing: run?.outcome === 'impact' ? { x: run.samples[run.samples.length - 1].x, y: 0 } : null };
    if (this.lastManual !== Renderer.isManualZoom()) this.updateMode();
    if (!Renderer.isManualZoom()) return;
    if (this.centre === 'landing' && !this.sites.landing) this.centre = 'free';
    this.markers.style.top = `${this.canvas.offsetTop}px`;
    this.markers.style.height = `${this.canvas.clientHeight}px`;
    for (const site of ['launch', 'landing'] as const) {
      const point = this.sites[site], button = this.panel.querySelector<HTMLButtonElement>(`[data-site="${site}"]`)!;
      button.disabled = !point;
      button.title = point ? `Centre zoom on ${site === 'launch' ? 'launch site' : 'landing location'}. Click again to release.` : 'No landing location for this flight';
      button.setAttribute('aria-pressed', String(this.centre === site));
      const marker = this.markers.querySelector<HTMLButtonElement>(`[data-site="${site}"]`)!;
      const pixel = point ? Renderer.toCanvas(point.x, point.y) : { x: -100, y: -100 };
      const y = pixel.y + (site === 'launch' ? -20 : 20);
      marker.hidden = !point || pixel.x < 40 || pixel.x > Renderer.getWidth() - 40 || y < 16 || y > Renderer.getHeight() - 16;
      marker.style.left = `${pixel.x}px`; marker.style.top = `${y}px`;
      marker.setAttribute('aria-pressed', String(this.centre === site));
    }
    this.panel.querySelector('.zoom-hint')!.textContent = this.centre === 'free'
      ? 'Scroll / pinch to zoom · drag to pan' : 'Centred on ' + this.centre + ' · click away to release';
  }
}
