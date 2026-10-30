import type { CrewPose } from './crew.ts';
import type { CloudGuestMotion } from './cloud-guests.ts';
import type { CrewFlight } from './crew-flight.ts';
import type { IceHole } from './squid.ts';

export interface ActiveIceHole extends Required<IceHole> { reserved: boolean }

/** Mutable presentation state shared by the scene lifecycle and its artwork. */
export interface SceneCharacter extends Omit<CrewPose, 'reaction'> {
  x: number; y: number; state: string; stateTimer: number; direction: number; speed: number;
  visible: boolean; walkTarget: number; bubbleText: string | null; bubbleTimer: number; thoughtCooldown: number;
  reaction?: CrewPose['reaction'] | null; silent?: boolean; banter?: boolean;
  flightReaction?: CrewFlight; gaitSpeed?: number;
  watchTarget?: {x:number;y:number}; inspectTarget?: {x:number;y:number};
  cloudMotion?: CloudGuestMotion; surfaceAmount?: number; activityTimer?: number; fleeing?: boolean; wasIdle?:boolean;
  portrait?: boolean; turn?: number; cloudEdge?: number[];
  spoutParticles?: {ox:number;oy:number;life:number}[];
  holes?: ActiveIceHole[]; holeTarget?: {x:number} | null; hole?: ActiveIceHole | null;
  holeX?: number; diveStartX?: number; exitX?: number;
}

export interface WorkerPose { x:number; y:number; pose:string; timer:number; direction:number }
export interface Particle {
  x:number; y:number; vx:number; vy:number; life:number; maxLife:number; radius:number; colour:string; gravity:number;
}
export interface ParticleOptions {
  count?:number; baseAngle?:number; spread?:number; minSpeed?:number; maxSpeed?:number; vyBoost?:number;
  minLife?:number; maxLife?:number; minRadius?:number; maxRadius?:number; colour?:string | (()=>string); gravity?:number;
}
export type RocketSprite = { phase:'pad' | 'fizzle' | 'fizzle_done' }
  | { phase:'flight'; x:number; y:number; theta?:number };
