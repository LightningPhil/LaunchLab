export interface CameraView { ppm: number; originX: number; originY: number }
export interface ScreenPoint { x: number; y: number }

/** A uniform scale/translation of the flight plane. Manual inspection changes
 * only the camera; it never modifies the recorded flight or its clock. */
export class InspectionCamera {
  active = false;
  view: CameraView = { ppm: 80, originX: 0, originY: 0 };
  private width = 0;
  private height = 0;

  start(view: CameraView, width: number, height: number) {
    this.view = { ...view }; this.width = width; this.height = height; this.active = true;
  }
  resize(width: number, height: number) {
    if (this.active) {
      this.view.originX += (width - this.width) / 2;
      this.view.originY += (height - this.height) / 2;
    }
    this.width = width; this.height = height;
  }
  zoom(factor: number, from: ScreenPoint, to = from) {
    if (!this.active || !Number.isFinite(factor) || factor <= 0) return;
    const ppm = Math.max(1e-8, Math.min(800, this.view.ppm * factor));
    const ratio = ppm / this.view.ppm;
    this.view = { ppm, originX: to.x - (from.x - this.view.originX) * ratio,
      originY: to.y - (from.y - this.view.originY) * ratio };
  }
  pan(x: number, y: number) {
    if (!this.active || !Number.isFinite(x + y)) return;
    this.view.originX += x; this.view.originY += y;
  }
  centre(point: ScreenPoint) {
    this.pan(this.width / 2 - point.x, this.height / 2 - point.y);
  }
}
