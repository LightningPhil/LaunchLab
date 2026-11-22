/**
 * world-palettes.ts — World Colour Palettes & Gravity Crossfade Interpolation
 *
 * Gravity, radius, and surface type come from `ENVIRONMENTS` so the physics
 * solver and scenery never disagree; only visual colour palettes live here.
 */
import { ENVIRONMENTS } from './environment.ts';

function world(name: string) {
  const environment = ENVIRONMENTS.find(candidate => candidate.name === name);
  if (!environment) throw new Error('renderer palette for unknown world ' + name);
  return { name, g: environment.gravity, radius: environment.radius, isGas: environment.isGas };
}

export const PLANETS = [
  { ...world('pluto'),
    skyTop:[5,7,19],        skyMid:[12,14,31],       skyBot:[30,31,49],
    groundTop:[190,181,164], groundBot:[132,121,105],
    subTop:[105,94,82],     subBot:[72,63,57],
    surfEdge:[217,211,197], moundCol:[161,149,132],
    features:'pluto' },
  { ...world('ganymede'),
    skyTop:[4,8,20],         skyMid:[10,20,39],       skyBot:[31,50,69],
    groundTop:[186,216,220], groundBot:[112,158,170],
    subTop:[75,125,143],     subBot:[40,78,104],
    surfEdge:[224,241,239],  moundCol:[140,181,190],
    features:'ganymede' },
  { ...world('moon'),
    skyTop:[5,5,15],       skyMid:[10,10,25],      skyBot:[25,25,45],
    groundTop:[150,148,142], groundBot:[115,113,108],
    subTop:[90,88,83],     subBot:[70,68,63],
    surfEdge:[165,163,158], moundCol:[135,133,128],
    features:'moon' },
  { ...world('mercury'),
    skyTop:[8,6,18],       skyMid:[18,14,32],      skyBot:[35,30,48],
    groundTop:[145,130,115], groundBot:[115,100,85],
    subTop:[88,78,63],     subBot:[68,58,48],
    surfEdge:[160,145,130], moundCol:[135,120,105],
    features:'mercury' },
  { ...world('mars'),
    skyTop:[165,105,75],   skyMid:[195,135,100],   skyBot:[215,165,135],
    groundTop:[190,110,68], groundBot:[160,88,52],
    subTop:[130,68,38],    subBot:[100,52,28],
    surfEdge:[205,128,78], moundCol:[180,105,62],
    features:'mars' },
  { ...world('venus'),
    skyTop:[195,155,55],   skyMid:[205,170,75],    skyBot:[218,185,100],
    groundTop:[180,128,48], groundBot:[150,105,38],
    subTop:[125,82,28],    subBot:[100,62,20],
    surfEdge:[200,148,58], moundCol:[170,120,42],
    features:'venus' },
  { ...world('uranus'),
    skyTop:[85,165,190],   skyMid:[105,190,215],   skyBot:[135,205,225],
    groundTop:[75,155,185], groundBot:[55,125,160],
    subTop:[45,105,140],   subBot:[35,85,120],
    surfEdge:[90,170,200], moundCol:[70,150,180],
    features:'icegas' },
  { ...world('earth'),
    skyTop:[130,176,190],  skyMid:[176,206,211],  skyBot:[228,231,208],
    groundTop:[126,153,110], groundBot:[89,120,86],
    subTop:[126,104,73],   subBot:[83,77,58],
    surfEdge:[167,179,126], moundCol:[116,144,99],
    features:'earth' },
  { ...world('saturn'),
    skyTop:[195,175,115],  skyMid:[210,195,145],   skyBot:[220,205,160],
    groundTop:[190,170,110], groundBot:[170,150,90],
    subTop:[150,130,75],   subBot:[130,110,58],
    surfEdge:[200,180,125], moundCol:[180,160,100],
    features:'saturn' },
  { ...world('neptune'),
    skyTop:[18,35,105],    skyMid:[28,55,140],     skyBot:[45,75,165],
    groundTop:[28,48,130], groundBot:[20,38,110],
    subTop:[15,28,90],     subBot:[10,20,68],
    surfEdge:[38,58,140],  moundCol:[25,42,118],
    features:'deepgas' },
  { ...world('jupiter'),
    skyTop:[200,150,100],  skyMid:[215,170,118],   skyBot:[225,185,140],
    groundTop:[180,128,78], groundBot:[160,108,58],
    subTop:[140,88,42],    subBot:[118,68,28],
    surfEdge:[190,138,88], moundCol:[170,118,68],
    features:'jupiter' },
  { ...world('sun'),
    skyTop:[58,5,8],        skyMid:[164,38,14],      skyBot:[246,128,28],
    groundTop:[255,207,70], groundBot:[210,67,17],
    subTop:[183,48,18],     subBot:[92,13,18],
    surfEdge:[255,232,119], moundCol:[239,139,33],
    features:'sun' },
];

export type PlanetPalette = typeof PLANETS[number];
export const EARTH_PLANET: PlanetPalette = PLANETS.find(planet => planet.name === 'earth') || PLANETS[0];

export interface BlendedEnvironment {
  skyTop: number[];
  skyMid: number[];
  skyBot: number[];
  groundTop: number[];
  groundBot: number[];
  subTop: number[];
  subBot: number[];
  surfEdge: number[];
  moundCol: number[];
  solidness: number;
  isGas: boolean;
  lowerPlanet: PlanetPalette;
  upperPlanet: PlanetPalette;
  lowerAlpha: number;
  upperAlpha: number;
  nearestPlanet: PlanetPalette;
}

export function createEnvironmentState(): BlendedEnvironment {
  return {
    skyTop: [93, 169, 233], skyMid: [135, 206, 235], skyBot: [182, 223, 247],
    groundTop: [90, 154, 106], groundBot: [74, 124, 89],
    subTop: [107, 68, 35], subBot: [74, 47, 21],
    surfEdge: [106, 173, 122], moundCol: [90, 140, 100],
    solidness: 1, isGas: false,
    lowerPlanet: EARTH_PLANET, upperPlanet: EARTH_PLANET,
    lowerAlpha: 1, upperAlpha: 0,
    nearestPlanet: EARTH_PLANET,
  };
}

export function lerpRGB(a: readonly number[], b: readonly number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function rgb(c: readonly number[]): string {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

export function rgba(c: readonly number[], a: number): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function findBracket(g: number): { lo: PlanetPalette; hi: PlanetPalette; t: number } {
  if (g <= PLANETS[0].g) return { lo: PLANETS[0], hi: PLANETS[0], t: 0 };
  const last = PLANETS[PLANETS.length - 1];
  if (g >= last.g) return { lo: last, hi: last, t: 0 };
  for (let i = 0; i < PLANETS.length - 1; i++) {
    if (g >= PLANETS[i].g && g <= PLANETS[i + 1].g) {
      const t = (g - PLANETS[i].g) / (PLANETS[i + 1].g - PLANETS[i].g);
      return { lo: PLANETS[i], hi: PLANETS[i + 1], t };
    }
  }
  return { lo: PLANETS[0], hi: PLANETS[0], t: 0 };
}

export function findNearest(g: number): PlanetPalette {
  let best = PLANETS[0];
  let bd = Math.abs(g - best.g);
  for (let i = 1; i < PLANETS.length; i++) {
    const d = Math.abs(g - PLANETS[i].g);
    if (d < bd) { bd = d; best = PLANETS[i]; }
  }
  return best;
}

export function getPlanetRadius(g: number): number {
  const b = findBracket(g);
  if (b.t === 0) return b.lo.radius;
  return b.lo.radius + (b.hi.radius - b.lo.radius) * b.t;
}

export function blendEnvironment(displayedGravity: number, env: BlendedEnvironment): void {
  const b = findBracket(displayedGravity);
  const t = b.t, lo = b.lo, hi = b.hi;

  env.skyTop    = lerpRGB(lo.skyTop,    hi.skyTop,    t);
  env.skyMid    = lerpRGB(lo.skyMid,    hi.skyMid,    t);
  env.skyBot    = lerpRGB(lo.skyBot,    hi.skyBot,    t);
  env.groundTop = lerpRGB(lo.groundTop, hi.groundTop, t);
  env.groundBot = lerpRGB(lo.groundBot, hi.groundBot, t);
  env.subTop    = lerpRGB(lo.subTop,    hi.subTop,    t);
  env.subBot    = lerpRGB(lo.subBot,    hi.subBot,    t);
  env.surfEdge  = lerpRGB(lo.surfEdge,  hi.surfEdge,  t);
  env.moundCol  = lerpRGB(lo.moundCol,  hi.moundCol,  t);

  const loS = lo.isGas ? 0 : 1;
  const hiS = hi.isGas ? 0 : 1;
  env.solidness = loS * (1 - t) + hiS * t;

  env.lowerPlanet = lo;
  env.upperPlanet = hi;
  env.lowerAlpha  = 1 - t;
  env.upperAlpha  = t;
  env.nearestPlanet = findNearest(displayedGravity);
  env.isGas = env.nearestPlanet.isGas;
}
