/**
 * scene-fx.ts — Particles, Landed Shots, Landed Rocket & Impact Shockwave
 *
 * Manages transient surface effects shared by cannon and rocket flights:
 * smoke/debris particles, landed cannonballs with spring-in flags, crashed
 * rocket markers, and impact shockwave rings.
 */
import type { Particle, ParticleOptions } from './scene-types.ts';

export interface LandedShot {
  x: number;
  number: number;
  flagSpring: number;
  isGas: boolean;
}

export interface LandedRocket {
  x: number;
  epsilon: number;
  timer: number;
  phase: string;
  impactSpeed: number | null;
}

function randomGrey(): string {
  const v = 140 + Math.floor(Math.random() * 80);
  return `rgb(${v},${v},${v})`;
}

function randomBrown(): string {
  return `rgb(${80 + Math.floor(Math.random() * 50)},${40 + Math.floor(Math.random() * 30)},${10 + Math.floor(Math.random() * 20)})`;
}

function randomGasColour(): string {
  const v = 100 + Math.floor(Math.random() * 60);
  return `rgb(${v},${v - 20},${v - 30})`;
}

export class SceneFx {
  particles: Particle[] = [];
  shots: LandedShot[] = [];
  landedRocket: LandedRocket | null = null;
  rocketLanded = false;
  impactShockwaveProgress = -1;
  impactShockwaveX = 0;
  private totalShotCount = 0;
  private readonly maxShots = 8;

  emitParticlesAt(x: number, y: number, opts: ParticleOptions = {}): void {
    const count = opts.count || 8;
    const baseAng = opts.baseAngle || 0;
    const spreadW = opts.spread !== undefined ? opts.spread : 1.0;
    const minSpd = opts.minSpeed || 1.5;
    const maxSpd = opts.maxSpeed || 4;
    const vyBoost = opts.vyBoost || 0;
    const minLife = opts.minLife || 0.5;
    const maxLife = opts.maxLife || 1.0;
    const minR = opts.minRadius || 3;
    const maxR = opts.maxRadius || 6;
    const grav = opts.gravity !== undefined ? opts.gravity : 0;

    for (let i = 0; i < count; i++) {
      const ang = baseAng + (Math.random() - 0.5) * spreadW;
      const speed = minSpd + Math.random() * (maxSpd - minSpd);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed + vyBoost,
        life: minLife + Math.random() * (maxLife - minLife),
        maxLife,
        radius: minR + Math.random() * (maxR - minR),
        colour: typeof opts.colour === 'function' ? opts.colour() : opts.colour || randomGrey(),
        gravity: grav,
      });
    }
  }

  emitCannonSmoke(tipX: number, tipY: number, angleDeg: number): void {
    const rad = (angleDeg * Math.PI) / 180;
    const count = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.2;
      const speed = 1.5 + Math.random() * 3;
      this.particles.push({
        x: tipX,
        y: tipY,
        vx: Math.cos(rad + spread) * speed,
        vy: Math.sin(rad + spread) * speed + 0.5,
        life: 1.0 + Math.random() * 0.4,
        maxLife: 1.4,
        radius: 4 + Math.random() * 6,
        colour: randomGrey(),
        gravity: -0.3,
      });
    }
  }

  emitImpact(physX: number, isGas: boolean): void {
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const ang = Math.PI * 0.15 + Math.random() * Math.PI * 0.7;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x: physX,
        y: 0.05,
        vx: Math.cos(ang) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.sin(ang) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        radius: 2 + Math.random() * 3,
        colour: isGas ? randomGasColour() : randomBrown(),
        gravity: 12,
      });
    }
  }

  emitFizzleSmoke(px: number, py: number): void {
    this.emitParticlesAt(px, py, {
      count: 15,
      baseAngle: Math.PI / 2,
      spread: 2.5,
      minSpeed: 0.8,
      maxSpeed: 2.5,
      vyBoost: 1.5,
      minLife: 1.0,
      maxLife: 2.5,
      minRadius: 3,
      maxRadius: 8,
      colour: () => {
        const v = 100 + Math.floor(Math.random() * 80);
        return `rgba(${v},${v},${v},0.6)`;
      },
      gravity: -0.5,
    });
  }

  recordCannonLanding(landX: number, isGas: boolean): void {
    if (this.shots.length >= this.maxShots) this.shots.shift();
    this.totalShotCount++;
    this.shots.push({
      x: landX,
      number: this.totalShotCount,
      flagSpring: 0,
      isGas,
    });
    this.emitImpact(landX, isGas);
    this.impactShockwaveProgress = 0;
    this.impactShockwaveX = landX;
  }

  recordRocketLanding(landX: number, epsilon: number, impactSpeed: number | null, isGas: boolean): void {
    this.emitImpact(landX, isGas);
    this.impactShockwaveProgress = 0;
    this.impactShockwaveX = landX;
    this.rocketLanded = true;
    this.landedRocket = { x: landX, epsilon, timer: 0, phase: 'impact', impactSpeed };
  }

  clearLanding(): void {
    this.shots = [];
    this.landedRocket = null;
    this.rocketLanded = false;
    this.particles = [];
    this.impactShockwaveProgress = -1;
  }

  resetAll(): void {
    this.clearLanding();
    this.totalShotCount = 0;
  }

  update(dt: number, reducedMotion: boolean): void {
    if (reducedMotion) {
      this.particles = [];
    } else {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.vy -= p.gravity * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
    }
    for (const shot of this.shots) {
      if (shot.flagSpring < 1) {
        shot.flagSpring = Math.min(1, shot.flagSpring + dt * 2.5);
      }
    }
    if (this.impactShockwaveProgress >= 0 && this.impactShockwaveProgress < 1) {
      this.impactShockwaveProgress += dt / 0.3;
      if (this.impactShockwaveProgress > 1) this.impactShockwaveProgress = 1.01;
    }
  }
}
