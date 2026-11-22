/**
 * character-stage.ts — Surface & Cloud Guest Lifecycle Coordinator
 *
 * Owns the active planet guest/crew member, idle remarks, silly business
 * schedule, flight reactions (flee/watch/inspect), cloud swimmers, and
 * Ganymede squid ice-hole placement.
 */
import { resolveEnvironment } from './environment.ts';
import { CharacterRemarks } from './character-remarks.ts';
import { cloudGuestActivity, createCloudGuest, diveCloudGuest, updateCloudGuest } from './cloud-guests.ts';
import { characterForWorld } from './world-characters.ts';
import { chooseIdleLook, rocketWatchAim } from './crew-watch.ts';
import { cancelBusiness, createBusinessClock, updateBusiness } from './character-business.ts';
import { beginCrewFlight, clearCrewFlight, inspectLanding, isWalkingGuest, updateCrewFlight } from './crew-flight.ts';
import { beginSquidBreakout, enterSquidHole, headForSquidHole, releaseSquidTarget, squidUnderIce, updateSquidHoles } from './squid-life.ts';
import { Renderer } from './renderer.ts';
import type { FlightRecord } from './flight.ts';
import type { SceneCharacter } from './scene-types.ts';
import type { LandedRocket, LandedShot } from './scene-fx.ts';

function toPhysX(canvasPx: number): number {
  const ppm = Renderer.getCurrentPPM();
  if (ppm <= 0) return 9999;
  const cameraX = -Renderer.toCanvasX(0) / ppm;
  return cameraX + canvasPx / ppm;
}

function nearbyGuestTarget(awayFrom?: number): number {
  const fieldWidth = Renderer.getWidth() / Renderer.DEFAULT_PPM;
  const left = Math.min(3.8, Math.max(2.8, fieldWidth * 0.48));
  const right = Math.max(left + 0.5, Math.min(7.2, fieldWidth * 0.6));
  const target = left + Math.random() * (right - left);
  if (awayFrom !== undefined && Number.isFinite(awayFrom) && Math.abs(target - awayFrom) < Math.min(0.75, (right - left) * 0.4)) {
    return awayFrom < (left + right) / 2 ? right : left;
  }
  return target;
}

function crewRetreatBounds(): { left: number; right: number } {
  const margin = Math.min(100, Renderer.getWidth() * 0.15);
  return { left: toPhysX(margin), right: toPhysX(Renderer.getWidth() - margin) };
}

export interface CharacterUpdateContext {
  gravity: number;
  planetRadius: number;
  banterEnabled: boolean;
  reducedMotion: boolean;
  crewBusy: boolean;
  viewActive: boolean;
  flightPaused: boolean;
  vehicle: { x: number; y: number } | null;
  shots: readonly LandedShot[];
  landedRocket: LandedRocket | null;
}

export class CharacterStage {
  character: SceneCharacter | null = null;
  private lastPlanet: string | null = null;
  private readonly remarks = new CharacterRemarks();
  private readonly businessClock = createBusinessClock();
  private lastCrewRemark = -30;
  private crewReactionUntil = 0;
  private readonly remarkCounts = new Map<string, number>();

  /** Clear ice for a new hole: past the cannon and launch pad, away from landed shots, crashed rockets, and other holes. */
  private freshHoleSpot(
    ch: SceneCharacter,
    shots: readonly LandedShot[],
    landedRocket: LandedRocket | null,
    avoidSquid = true,
    preferredDirection = 0
  ): number {
    const fieldWidth = Renderer.getWidth() / Renderer.DEFAULT_PPM;
    const left = Math.max(Renderer.CANNON_BASE_X_M, Renderer.TOWER_BASE_X_M || 0) + 1.9;
    const right = Math.max(left + 1.5, fieldWidth - 0.8);
    const keepClear = [
      ...(ch.holes ?? []).map(hole => ({ x: hole.x, gap: 1.4 })),
      ...shots.filter(shot => !shot.isGas).map(shot => ({ x: shot.x, gap: 0.9 })),
      ...(landedRocket ? [{ x: landedRocket.x, gap: 1.6 }] : []),
      ...(avoidSquid ? [{ x: ch.x, gap: 1.2 }] : []),
    ];
    let best = left + Math.random() * (right - left);
    let bestScore = -Infinity;
    for (let tries = 0; tries < 16; tries++) {
      const x = left + Math.random() * (right - left);
      const score =
        Math.min(0, ...keepClear.map(spot => Math.abs(spot.x - x) - spot.gap)) -
        (preferredDirection && (x - ch.x) * preferredDirection < 0.5 ? 6 : 0);
      if (score > bestScore) {
        best = x;
        bestScore = score;
      }
      if (score >= 0) break;
    }
    return best;
  }

  private createCharacter(
    type: string,
    reducedMotion: boolean,
    shots: readonly LandedShot[],
    landedRocket: LandedRocket | null
  ): SceneCharacter {
    const spawnX = toPhysX(Renderer.getWidth()) * 0.7 + Math.random() * 5;
    const ch: SceneCharacter = {
      type,
      x: spawnX,
      y: 0,
      state: 'walking',
      stateTimer: 0,
      direction: -1,
      visible: true,
      walkTarget: 8 + Math.random() * 15,
      speed: 0.95 + Math.random() * 0.35,
      bubbleText: null,
      bubbleTimer: 0,
      thoughtCooldown: 1.5,
    };
    if (type === 'whale' || type === 'submarine') {
      const visibleMetres = Renderer.getWidth() / Renderer.DEFAULT_PPM;
      const fieldX = Math.max(2.8, Math.min(7.5, visibleMetres * 0.68));
      ch.cloudMotion = createCloudGuest(fieldX, { kind: type, reducedMotion });
      Object.assign(ch, {
        x: ch.cloudMotion.x,
        y: ch.cloudMotion.y,
        surfaceAmount: ch.cloudMotion.surfaceAmount,
        state: 'cruising',
        direction: 1,
      });
    } else if (type === 'icebear') {
      ch.x = nearbyGuestTarget();
      ch.walkTarget = ch.x;
      ch.state = 'idle';
      ch.speed = 1.05;
      ch.silent = true;
      ch.banter = false;
    } else if (isWalkingGuest(type)) {
      ch.x = nearbyGuestTarget();
      ch.walkTarget = ch.x;
      ch.state = 'idle';
    } else if (type === 'squid') {
      ch.holes = [];
      ch.holeTarget = null;
      ch.hole = null;
      ch.x = this.freshHoleSpot(ch, shots, landedRocket, false);
      ch.walkTarget = ch.x;
      ch.speed = 0.45;
      beginSquidBreakout(ch);
    }
    return ch;
  }

  syncToWorld(
    gravity: number,
    reducedMotion: boolean,
    shots: readonly LandedShot[],
    landedRocket: LandedRocket | null
  ): void {
    const name = resolveEnvironment(gravity).name;
    if (name === this.lastPlanet) return;
    this.lastPlanet = name;
    const type = characterForWorld(name);
    this.character = type ? this.createCharacter(type, reducedMotion, shots, landedRocket) : null;
  }

  ensureFlight(run: FlightRecord | null, viewActive: boolean, clockTime: number): void {
    if (!run || !viewActive || run.outcome === 'no-liftoff' || clockTime >= run.duration || !this.character) return;
    if (this.character.flightReaction?.stage === 'flight') return;
    clearCrewFlight(this.character, true);
    beginCrewFlight(this.character, run.launchX, run.mode, crewRetreatBounds(), clockTime > 0, run.duration);
  }

  startle(isRocket: boolean, flightDuration?: number): void {
    const ch = this.character;
    if (!ch) return;
    if (isWalkingGuest(ch.type)) {
      beginCrewFlight(
        ch,
        isRocket ? Renderer.TOWER_BASE_X_M : Renderer.CANNON_BASE_X_M,
        isRocket ? 'rocket' : 'cannon',
        crewRetreatBounds(),
        false,
        flightDuration
      );
      return;
    }
    if (!ch.visible || ch.state === 'squashed' || squidUnderIce(ch)) return;
    if (ch.cloudMotion) {
      const sourceX = isRocket ? Renderer.TOWER_BASE_X_M || 1.5 : Renderer.CANNON_BASE_X_M;
      ch.cloudMotion = diveCloudGuest(ch.cloudMotion, isRocket ? 18 : 12, sourceX);
      ch.state = 'startled';
      ch.stateTimer = 0;
      ch.fleeing = true;
      ch.bubbleText = null;
      return;
    }
    if (ch.holes) releaseSquidTarget(ch);
    ch.state = isRocket ? 'rocket_startled' : 'startled';
    ch.stateTimer = 0;
    if (!isRocket) ch.bubbleText = null;
  }

  checkCannonSquash(landX: number): void {
    const ch = this.character;
    if (!ch || !ch.visible || ch.state === 'squashed' || ch.state === 'off_screen' || squidUnderIce(ch)) return;
    if (Math.abs(landX - ch.x) >= 1.0) return;
    if (ch.cloudMotion) {
      ch.cloudMotion = diveCloudGuest(ch.cloudMotion);
      return;
    }
    if (ch.holes) releaseSquidTarget(ch);
    ch.state = 'squashed';
    ch.stateTimer = 0;
    ch.bubbleText = null;
  }

  inspectLanding(x: number, mode: 'cannon' | 'rocket', planetRadius: number): void {
    inspectLanding(this.character, { x, y: 0 }, mode, planetRadius);
  }

  cancelBusiness(): void {
    cancelBusiness(this.businessClock);
  }

  resetReaction(): void {
    cancelBusiness(this.businessClock);
    this.crewReactionUntil = 0;
    this.lastCrewRemark = -30;
    this.remarkCounts.clear();
    const ch = this.character;
    if (!ch) return;
    clearCrewFlight(ch, true);
    delete ch.watchAim;
    delete ch.watchTarget;
    ch.reaction = null;
    ch.bubbleText = null;
    ch.bubbleTimer = 0;
    ch.thoughtCooldown = 4;
  }

  private say(text: string, banterEnabled: boolean, seconds = 4): void {
    const ch = this.character;
    if (!ch || !banterEnabled || ch.banter === false) return;
    ch.bubbleText = text;
    ch.bubbleTimer = seconds;
    ch.thoughtCooldown = 4 + Math.random() * 3;
  }

  react(kind: string, gravity: number, banterEnabled: boolean): void {
    const ch = this.character;
    if (!ch) return;
    const mapped = kind === 'no-liftoff' ? 'fizzle' : kind;
    ch.reaction =
      mapped === 'coast' || mapped === 'apex' || mapped === 'impact' || mapped === 'escape' || mapped === 'fizzle'
        ? mapped
        : null;
    if (mapped !== 'coast') this.crewReactionUntil = performance.now() / 1000 + 4;
    const now = performance.now() / 1000;
    const count = this.remarkCounts.get(mapped) || 0;
    if (banterEnabled && now - this.lastCrewRemark > 8 && count < 2) {
      const line = this.remarks.reaction(mapped, resolveEnvironment(gravity));
      if (line) {
        this.say(line, banterEnabled);
        this.lastCrewRemark = now;
        this.remarkCounts.set(mapped, count + 1);
      }
    }
  }

  maybeReactToFastCoast(clockRate: number, gravity: number, banterEnabled: boolean): void {
    if (clockRate > 4 && performance.now() / 1000 > this.crewReactionUntil && this.character?.reaction !== 'coast') {
      this.react('coast', gravity, banterEnabled);
    }
  }

  get isFlightApproaching(): boolean {
    const stage = this.character?.flightReaction?.stage ?? '';
    return stage === 'flight' || stage === 'approach';
  }

  update(dt: number, captionDt: number, ctx: CharacterUpdateContext): void {
    const ch = this.character;
    if (ch) ch.banter = ctx.banterEnabled && !ch.silent;
    updateBusiness(this.businessClock, ch, captionDt, ctx.crewBusy);
    if (!ch) return;

    ch.reducedMotion = ctx.reducedMotion;
    ch.stateTimer += dt;
    if (ch.state === 'idle' && isWalkingGuest(ch.type) && !ch.wasIdle) ch.idleLook = chooseIdleLook();
    ch.wasIdle = ch.state === 'idle';

    if (!ctx.banterEnabled || ch.silent) {
      ch.bubbleText = null;
      ch.bubbleTimer = 0;
      ch.thoughtCooldown = 1.5;
    }
    if (ch.bubbleText) {
      ch.bubbleTimer -= captionDt;
      if (ch.bubbleTimer <= 0) ch.bubbleText = null;
    }
    if (!ch.bubbleText && ctx.banterEnabled && ch.banter !== false) {
      ch.thoughtCooldown -= captionDt;
      if (ch.thoughtCooldown <= 0) {
        this.say(this.remarks.next(resolveEnvironment(ctx.gravity)), ctx.banterEnabled, 5);
      }
    }

    if (ch.business) {
      ch.stateTimer = ch.business.elapsed;
      return;
    }
    if (updateCrewFlight(ch, captionDt, ctx.viewActive ? ctx.vehicle : null, ctx.planetRadius, ctx.flightPaused, ctx.reducedMotion)) {
      return;
    }

    if (ch.cloudMotion) {
      const vehicle = ctx.viewActive ? ctx.vehicle : null;
      const watching = ch.type === 'submarine' && !!vehicle;
      const swimDt = ctx.viewActive && ctx.flightPaused ? 0 : captionDt;
      ch.cloudMotion = updateCloudGuest(ch.cloudMotion, swimDt, { watching, reducedMotion: ctx.reducedMotion });
      const motion = ch.cloudMotion;
      const state = watching && motion.phase === 'surfaced' ? 'watching' : cloudGuestActivity(motion.kind, motion);
      ch.watchAim = state === 'watching' ? rocketWatchAim(motion.x, vehicle!, ctx.planetRadius) : undefined;
      ch.watchTarget = state === 'watching' ? { x: vehicle!.x, y: vehicle!.y } : undefined;
      const direction = motion.fleeing ? motion.fleeDirection : Math.cos(motion.age * 0.15) >= 0 ? 1 : -1;
      const turn =
        ch.turn !== undefined && Number.isFinite(ch.turn) && !ctx.reducedMotion
          ? ch.turn + Math.max(-3 * swimDt, Math.min(3 * swimDt, direction - ch.turn))
          : direction;
      Object.assign(ch, {
        x: motion.x,
        y: motion.y,
        surfaceAmount: motion.surfaceAmount,
        stateTimer: motion.age,
        activityTimer: motion.elapsed,
        reducedMotion: ctx.reducedMotion,
        state,
        direction: turn < 0 ? -1 : 1,
        turn,
        fleeing: motion.fleeing,
      });
      return;
    }

    const findHole = (actor: SceneCharacter, avoidSquid?: boolean, preferredDir?: number) =>
      this.freshHoleSpot(actor, ctx.shots, ctx.landedRocket, avoidSquid, preferredDir);

    if (updateSquidHoles(ch, dt, findHole)) return;

    switch (ch.state) {
      case 'walking':
        ch.x += ch.direction * ch.speed * dt;
        if ((ch.direction < 0 && ch.x <= ch.walkTarget) || (ch.direction > 0 && ch.x >= ch.walkTarget)) {
          if (ch.holes && ch.holeTarget != null) {
            enterSquidHole(ch);
            break;
          }
          ch.state = 'idle';
          ch.stateTimer = 0;
          ch.direction = ch.x > 10 ? -1 : 1;
        }
        break;

      case 'idle':
        if (ch.stateTimer > (ch.idleLook?.duration ?? (ch.type === 'squid' ? 5 : 4) + Math.random() * 4)) {
          if (ch.holes) {
            headForSquidHole(ch, findHole(ch));
            break;
          }
          ch.walkTarget = nearbyGuestTarget(ch.x);
          ch.direction = ch.walkTarget > ch.x ? 1 : -1;
          if (ch.type === 'icebear') ch.speed = 1.05;
          ch.state = 'walking';
          ch.stateTimer = 0;
        }
        break;

      case 'startled':
        if (ch.stateTimer > 0.6) {
          const away = ch.x > Renderer.CANNON_BASE_X_M ? 1 : -1;
          if (ch.holes) {
            headForSquidHole(ch, findHole(ch, true, away), 'running_away');
            break;
          }
          ch.state = 'running_away';
          ch.stateTimer = 0;
          ch.direction = away;
        }
        break;

      case 'rocket_startled':
        if (ch.stateTimer > 1.8) {
          const away = ch.x > (Renderer.TOWER_BASE_X_M || 1.5) ? 1 : -1;
          if (ch.holes) {
            headForSquidHole(ch, findHole(ch, true, away), 'running_away');
            break;
          }
          ch.state = 'running_away';
          ch.stateTimer = 0;
          ch.direction = away;
        }
        break;

      case 'running_away':
        ch.x += ch.direction * ch.speed * 3.5 * dt;
        if (ch.holes && ch.holeTarget != null) {
          if ((ch.walkTarget - ch.x) * ch.direction <= 0) enterSquidHole(ch);
          break;
        }
        if (ch.x < -2 || ch.x > toPhysX(Renderer.getWidth()) + 5) {
          ch.state = 'off_screen';
          ch.stateTimer = 0;
          ch.visible = false;
        }
        break;

      case 'off_screen':
        if (ch.stateTimer > 4 + Math.random() * 3) {
          ch.state = 'returning';
          ch.stateTimer = 0;
          ch.visible = true;
          ch.x = ch.direction > 0 ? -1 : toPhysX(Renderer.getWidth()) + 2;
          const returnsNearby = ch.type === 'icebear' || ch.type === 'squid';
          ch.walkTarget = returnsNearby ? nearbyGuestTarget() : 8 + Math.random() * 15;
          ch.direction = ch.walkTarget >= ch.x ? 1 : -1;
          ch.speed = ch.type === 'icebear' ? 1.2 : ch.type === 'squid' ? 0.6 : 1.05 + Math.random() * 0.35;
        }
        break;

      case 'returning':
        ch.x += ch.direction * ch.speed * dt;
        if ((ch.direction < 0 && ch.x <= ch.walkTarget) || (ch.direction > 0 && ch.x >= ch.walkTarget)) {
          ch.state = 'idle';
          ch.stateTimer = 0;
        }
        break;

      case 'squashed': {
        const refuge = ch.stateTimer > 3 && ch.holes ? findHole(ch) : null;
        if (refuge) {
          headForSquidHole(ch, refuge, 'running_away');
        } else if (ch.stateTimer > 3) {
          ch.state = 'off_screen';
          ch.stateTimer = 0;
          ch.visible = false;
          ch.direction = 1;
        }
        break;
      }
    }
  }
}
