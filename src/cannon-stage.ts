/**
 * cannon-stage.ts — Cannon Recoil, Muzzle Flash & Barrel-Crew Choreography
 *
 * Manages the cannon's recoil/flash animations and the stickman crew sequence
 * ('idle' → 'lowering' → 'modifying' → 'raising' → 'idle') when barrel length
 * changes. Pure presentation state — decoupled from DOM and Web Audio.
 */
import type { WorkerPose } from './scene-types.ts';

export type BarrelAnimState = 'idle' | 'lowering' | 'modifying' | 'raising';

export interface BarrelUpdateCallbacks {
  onBarrelLength: (length: number) => void;
  onClang: () => void;
}

export class CannonStage {
  recoilOffset = 0;
  private recoilPhase: 0 | 1 | 2 = 0;
  private recoilTimer = 0;
  flashProgress = -1;
  private flashTimer = 0;

  animState: BarrelAnimState = 'idle';
  private animTimer = 0;
  private oldAngle = 45;
  private targetAngle = 45;
  private oldLen = 1.5;
  private targetLen = 1.5;
  displayedLen = 1.5;
  displayedAngle = 45;
  private extending = true;
  private modDuration = 0.8;
  private clangCooldown = 0;

  get isRebuilding(): boolean {
    return this.animState !== 'idle';
  }

  init(barrelLength: number, angle = 45): void {
    this.displayedLen = barrelLength;
    this.oldLen = barrelLength;
    this.targetLen = barrelLength;
    this.displayedAngle = angle;
    this.oldAngle = angle;
    this.targetAngle = angle;
  }

  /** Immediately settle the barrel at the given length and angle, cancelling any rebuild/recoil. */
  snapTo(barrelLength: number, angle: number, resetEffects = false): void {
    this.animState = 'idle';
    this.animTimer = 0;
    this.displayedLen = barrelLength;
    this.targetLen = barrelLength;
    this.displayedAngle = angle;
    if (resetEffects) {
      this.recoilPhase = 0;
      this.recoilOffset = 0;
      this.flashProgress = -1;
    }
  }

  triggerFireEffect(): void {
    this.recoilPhase = 1;
    this.recoilTimer = 0;
    this.flashProgress = 0;
    this.flashTimer = 0;
  }

  onBarrelChange(
    newLen: number,
    sliderAngle: number,
    ballActive: boolean,
    setRendererLength: (length: number) => void
  ): void {
    if (ballActive) {
      this.displayedLen = newLen;
      this.targetLen = newLen;
      setRendererLength(newLen);
      return;
    }

    if (Math.abs(newLen - this.targetLen) < 0.01 && this.animState !== 'idle') return;

    const currentAngle = this.animState !== 'idle' ? this.displayedAngle : sliderAngle;

    if (this.animState === 'idle') {
      this.oldAngle = currentAngle;
      this.targetAngle = currentAngle;
      this.oldLen = this.displayedLen;
      this.targetLen = newLen;
      this.extending = newLen > this.oldLen;
      this.modDuration = 0.18 + Math.abs(newLen - this.oldLen) * 0.04;
      this.animState = 'lowering';
      this.animTimer = 0;
      this.displayedAngle = currentAngle;
      this.clangCooldown = 0;
    } else if (this.animState === 'lowering' || this.animState === 'modifying') {
      this.targetLen = newLen;
      this.extending = newLen > this.displayedLen;
      this.modDuration = Math.max(0.4, 0.6 + Math.abs(newLen - this.displayedLen) * 0.3);
      if (this.animState === 'modifying') {
        this.oldLen = this.displayedLen;
        this.animTimer = 0;
      }
    } else if (this.animState === 'raising') {
      this.oldAngle = this.displayedAngle;
      this.targetLen = newLen;
      this.extending = newLen > this.displayedLen;
      this.modDuration = Math.max(0.4, 0.6 + Math.abs(newLen - this.displayedLen) * 0.3);
      this.animState = 'lowering';
      this.animTimer = 0;
    }
  }

  updateRecoilAndFlash(dt: number): void {
    if (this.recoilPhase === 1) {
      this.recoilTimer += dt;
      this.recoilOffset = Math.min(15, (this.recoilTimer / 0.08) * 15);
      if (this.recoilTimer >= 0.08) {
        this.recoilPhase = 2;
        this.recoilTimer = 0;
      }
    } else if (this.recoilPhase === 2) {
      this.recoilTimer += dt;
      this.recoilOffset = 15 * Math.max(0, 1 - this.recoilTimer / 0.2);
      if (this.recoilTimer >= 0.2) {
        this.recoilPhase = 0;
        this.recoilOffset = 0;
      }
    }
    if (this.flashProgress >= 0 && this.flashProgress < 1) {
      this.flashTimer += dt;
      this.flashProgress = Math.min(1, this.flashTimer / 0.06);
    }
  }

  updateBarrel(dt: number, sliderAngle: number, callbacks: BarrelUpdateCallbacks): void {
    if (this.animState === 'idle') return;

    this.animTimer += dt;
    this.targetAngle = sliderAngle;

    switch (this.animState) {
      case 'lowering': {
        const lDur = 0.12;
        const lT = Math.min(1, this.animTimer / lDur);
        const easeOut = 1 - (1 - lT) * (1 - lT);
        this.displayedAngle = this.oldAngle * (1 - easeOut);
        if (lT >= 1) {
          this.animState = 'modifying';
          this.animTimer = 0;
          this.displayedAngle = 0;
          this.oldLen = this.displayedLen;
          this.clangCooldown = 0.05;
        }
        break;
      }
      case 'modifying': {
        const mT = Math.min(1, this.animTimer / this.modDuration);
        const smooth = mT * mT * (3 - 2 * mT);
        this.displayedLen = this.oldLen + (this.targetLen - this.oldLen) * smooth;
        callbacks.onBarrelLength(this.displayedLen);
        this.displayedAngle = 0;
        this.clangCooldown -= dt;
        if (this.clangCooldown <= 0 && mT < 0.95) {
          callbacks.onClang();
          this.clangCooldown = 0.12 + Math.random() * 0.1;
        }
        if (mT >= 1) {
          this.animState = 'raising';
          this.animTimer = 0;
          this.displayedLen = this.targetLen;
          callbacks.onBarrelLength(this.displayedLen);
        }
        break;
      }
      case 'raising': {
        const rDur = 0.12;
        const rT = Math.min(1, this.animTimer / rDur);
        const easeIn = rT * rT;
        this.displayedAngle = this.targetAngle * easeIn;
        if (rT >= 1) {
          this.animState = 'idle';
          this.displayedAngle = this.targetAngle;
        }
        break;
      }
    }
  }

  effectiveAngle(sliderAngle: number): number {
    return this.animState !== 'idle' ? this.displayedAngle : sliderAngle;
  }

  setupEnvelope(values: { barrelLength: number; angle: number }): {
    rebuilding: boolean;
    lengths: number[];
    angles: number[];
  } {
    const rebuilding = this.animState !== 'idle';
    return {
      rebuilding,
      lengths: rebuilding ? [values.barrelLength, this.displayedLen, this.oldLen, this.targetLen] : [values.barrelLength],
      angles: rebuilding ? [values.angle, this.displayedAngle, this.oldAngle, this.targetAngle] : [values.angle],
    };
  }

  getCrew(cannonBaseX: number): WorkerPose[] | null {
    if (this.animState === 'idle') return null;

    const tipX = cannonBaseX + this.displayedLen;
    const crew: WorkerPose[] = [];

    switch (this.animState) {
      case 'lowering': {
        const lt = Math.min(1, this.animTimer / 0.4);
        const runEase = lt * lt;
        const startOff = 8;
        const run1 = tipX + startOff * (1 - runEase) + 0.3;
        const run2 = tipX + (startOff + 0.6) * (1 - Math.min(1, runEase * 1.1)) + 0.5;
        const run3 = tipX + (startOff + 1.2) * (1 - Math.min(1, runEase * 1.05)) + 0.8;
        crew.push({ x: run1, y: 0, pose: this.extending ? 'carrying' : 'running', timer: this.animTimer, direction: -1 });
        crew.push({ x: run2, y: 0, pose: 'running', timer: this.animTimer + 0.3, direction: -1 });
        crew.push({ x: run3, y: 0, pose: 'panicked', timer: this.animTimer, direction: -1 });
        break;
      }
      case 'modifying': {
        crew.push({ x: tipX + 0.2, y: 0, pose: 'screwing', timer: this.animTimer, direction: -1 });
        crew.push({ x: tipX + 0.6, y: 0, pose: 'screwing', timer: this.animTimer + 0.5, direction: 1 });
        const paceX = tipX + 0.4 + Math.sin(this.animTimer * 4) * 0.6;
        const paceDir = Math.cos(this.animTimer * 4) > 0 ? 1 : -1;
        crew.push({ x: paceX, y: 0, pose: 'panicked', timer: this.animTimer, direction: paceDir });
        break;
      }
      case 'raising': {
        const rt = this.animTimer / 0.4;
        if (rt < 0.45) {
          crew.push({ x: tipX + 0.2, y: 0, pose: 'celebrating', timer: this.animTimer, direction: 1 });
          crew.push({ x: tipX + 0.5, y: 0, pose: 'celebrating', timer: this.animTimer + 0.3, direction: -1 });
          crew.push({ x: tipX + 0.8, y: 0, pose: 'celebrating', timer: this.animTimer + 0.6, direction: 1 });
        } else {
          const runOff = (rt - 0.45) * 14;
          crew.push({ x: tipX + 0.2 + runOff, y: 0, pose: 'running', timer: this.animTimer, direction: 1 });
          crew.push({ x: tipX + 0.5 + runOff * 0.88, y: 0, pose: 'running', timer: this.animTimer + 0.2, direction: 1 });
          crew.push({ x: tipX + 0.8 + runOff * 0.75, y: 0, pose: 'panicked', timer: this.animTimer, direction: 1 });
        }
        break;
      }
    }

    return crew;
  }
}
