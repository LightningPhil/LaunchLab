import * as THREE from 'three';

type Point = { x: number; y: number };
type TouchPointer = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>;

// Track the centre of the fingers separately from TrackballControls' pinch
// zoom. Accumulate until the next frame so a symmetric pinch does not also pan.
export class TouchPan {
  private points = new Map<number, Point>();
  private dx = 0;
  private dy = 0;
  suppressTap = false;

  start(event: TouchPointer) {
    if (!this.points.size) this.suppressTap = false;
    this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.points.size > 1) this.suppressTap = true;
  }

  move(event: TouchPointer) {
    const point = this.points.get(event.pointerId);
    if (!point) return;
    // A third contact suspends panning until there are exactly two again.
    if (this.points.size === 2) {
      this.dx += (event.clientX - point.x) / 2;
      this.dy += (event.clientY - point.y) / 2;
    }
    point.x = event.clientX;
    point.y = event.clientY;
  }

  end(event: TouchPointer) {
    this.points.delete(event.pointerId);
  }

  consume(): Point {
    const delta = { x: this.dx, y: this.dy };
    this.dx = this.dy = 0;
    return delta;
  }

  reset() {
    this.points.clear();
    this.dx = this.dy = 0;
    this.suppressTap = true;
  }
}

// Move the scene by screen pixels, including in rolled and close-up views.
export function panOrthographic(camera: THREE.OrthographicCamera, target: THREE.Vector3,
  width: number, height: number, dx: number, dy: number) {
  if ((!dx && !dy) || width <= 0 || height <= 0) return;
  camera.updateMatrixWorld();
  const delta = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    .multiplyScalar(-dx * (camera.right - camera.left) / (camera.zoom * width));
  delta.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1),
    dy * (camera.top - camera.bottom) / (camera.zoom * height));
  camera.position.add(delta);
  target.add(delta);
}
