/** JPL long-term heliocentric elements, J2000 ecliptic/equinox.
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html (Tables 2a/2b)
 * UI dates are limited to AD 1000–3000, within the model's validity interval.
 * Pluto's original JPL row is preserved in https://docs.rs/satkit/latest/src/satkit/lpephem/planets.rs.html.
 * Spin periods and diameters: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
 * UTC approximates dynamical time here; this is an educational Keplerian
 * ephemeris, not an N-body integrator or a navigation ephemeris.
 */
import { CATALOGUE_MOONS, ASTEROIDS, KUIPER_BODIES } from './orrery-catalogue.ts';
export { ASTEROIDS, KUIPER_BODIES } from './orrery-catalogue.ts';
export const DAY_MS = 86400000;
export const YEAR_DAYS = 365.25;
export const J2000 = Date.UTC(2000, 0, 1, 12);
export const MIN_DATE = Date.UTC(1000, 0, 1);
export const MAX_DATE = Date.UTC(3000, 0, 1);
export const AU_KM = 149597870.7;
export const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
type Six = [number, number, number, number, number, number];
export interface World {
  id: string; name: string; colour: string; diameterKm: number;
  displayDiameter: number; tilt: number; spinHours: number;
  elements?: Six; rates?: Six; corrections?: [number,number,number,number];
  kind?: 'asteroid'|'dwarf-planet'|'kuiper-object';
  region?: 'asteroids'|'kuiper'; spinIllustrative?:boolean;
  kepler?: {epochJD:number;meanMotion:number};
  satellite?: {parent:string;distanceKm:number;periodDays:number;epochJD:number;
    eccentricity:number;meanAnomaly:number;argumentOfPeriapsis:number;
    inclination:number;ascendingNode:number;frame:string;poleRaDec?:[number,number]};
}
export const WORLDS: World[] = [
  { id:'sun', name:'Sun', colour:'#ffd17b', diameterKm:1392700, displayDiameter:3, tilt:7.25, spinHours:609.12 },
  { id:'mercury', name:'Mercury', colour:'#b9aaa0', diameterKm:4879, displayDiameter:.85, tilt:.034, spinHours:1407.6,
    elements:[.38709843,.20563661,7.00559432,252.25166724,77.45771895,48.33961819], rates:[0,.00002123,-.00590158,149472.67486623,.15940013,-.12214182] },
  { id:'venus', name:'Venus', colour:'#e7c28a', diameterKm:12104, displayDiameter:1, tilt:177.4, spinHours:5832.5,
    elements:[.72332102,.00676399,3.39777545,181.97970850,131.76755713,76.67261496], rates:[-.00000026,-.00005107,.00043494,58517.81560260,.05679648,-.27274174] },
  { id:'earth', name:'Earth', colour:'#72b8df', diameterKm:12756, displayDiameter:1, tilt:23.4, spinHours:23.9345,
    elements:[1.00000018,.01673163,-.00054346,100.46691572,102.93005885,-5.11260389], rates:[-.00000003,-.00003661,-.01337178,35999.37306329,.31795260,-.24123856] },
  { id:'mars', name:'Mars', colour:'#db8f70', diameterKm:6792, displayDiameter:.9, tilt:25.2, spinHours:24.6229,
    elements:[1.52371243,.09336511,1.85181869,-4.56813164,-23.91744784,49.71320984], rates:[.00000097,.00009149,-.00724757,19140.29934243,.45223625,-.26852431] },
  { id:'jupiter', name:'Jupiter', colour:'#d9b08c', diameterKm:142984, displayDiameter:2, tilt:3.1, spinHours:9.925,
    elements:[5.20248019,.04853590,1.29861416,34.33479152,14.27495244,100.29282654], rates:[-.00002864,.00018026,-.00322699,3034.90371757,.18199196,.13024619], corrections:[-.00012452,.06064060,-.35635438,38.35125] },
  { id:'saturn', name:'Saturn', colour:'#e7d3a0', diameterKm:120536, displayDiameter:1.55, tilt:26.7, spinHours:10.7,
    elements:[9.54149883,.05550825,2.49424102,50.07571329,92.86136063,113.63998702], rates:[-.00003065,-.00032044,.00451969,1222.11494724,.54179478,-.25015002], corrections:[.00025899,-.13434469,.87320147,38.35125] },
  { id:'uranus', name:'Uranus', colour:'#9cdadd', diameterKm:51118, displayDiameter:1.15, tilt:97.8, spinHours:17.2,
    elements:[19.18797948,.04685740,.77298127,314.20276625,172.43404441,73.96250215], rates:[-.00020455,-.00001550,-.00180155,428.49512595,.09266985,.05739699], corrections:[.00058331,-.97731848,.17689245,7.67025] },
  { id:'neptune', name:'Neptune', colour:'#638bdd', diameterKm:49528, displayDiameter:1.12, tilt:28.3, spinHours:16.1,
    elements:[30.06952752,.00895439,1.77005520,304.22289287,46.68158724,131.78635853], rates:[.00006447,.00000818,.00022400,218.46515314,.01009938,-.00606302], corrections:[-.00041348,.68346318,-.10162547,7.67025] },
  { id:'pluto', name:'Pluto', colour:'#c7aa99', diameterKm:2376, displayDiameter:.82, tilt:119.5, spinHours:153.3,
    elements:[39.48686035,.24885238,17.14104260,238.96535011,224.09702598,110.30167986], rates:[.00449751,.00006016,.00000501,145.18042903,-.00968827,-.00809981], corrections:[-.01262724,0,0,0] },
];
export const ALL_MOONS=CATALOGUE_MOONS;
export const MOONS=ALL_MOONS.filter(m=>['moon','ganymede','charon'].includes(m.id));
export const moonsFor=(expanded=false)=>expanded?ALL_MOONS:MOONS;
export const isExtraWorld=(id:string)=>[...ASTEROIDS,...KUIPER_BODIES].some(w=>w.id===id)||ALL_MOONS.some(w=>w.id===id)&&!MOONS.some(w=>w.id===id);
export const worldsFor=(expanded=false)=>[
  ...WORLDS.flatMap(world=>[world,...moonsFor(expanded).filter(m=>m.satellite!.parent===world.id)]),
  ...(expanded?[...ASTEROIDS,...KUIPER_BODIES]:[]),
];
export const jdToMs=(jd:number)=>J2000+(jd-2451545)*DAY_MS;
const OBLIQUITY=23.439291111*RAD;
export function eclipticPole([raDeg,decDeg]:[number,number]):[number,number,number] {
  const ra=raDeg*RAD,dec=decDeg*RAD;
  const y=Math.sin(ra)*Math.cos(dec),z=Math.sin(dec);
  return [Math.cos(ra)*Math.cos(dec),Math.cos(OBLIQUITY)*y+Math.sin(OBLIQUITY)*z,-Math.sin(OBLIQUITY)*y+Math.cos(OBLIQUITY)*z];
}
/** JPL nodes in a local plane start at that plane's ascending node on the
 * ICRF equator, rather than the ecliptic equinox. Build that basis explicitly. */
export function satellitePositionAt(world:World,ms:number,eccentricAnomaly?:number):[number,number,number] {
  const s=world.satellite!,days=(ms-jdToMs(s.epochJD))/DAY_MS;
  const peri=s.argumentOfPeriapsis+s.ascendingNode;
  const local=positionFromElements([s.distanceKm/AU_KM,s.eccentricity,s.inclination,
    s.meanAnomaly+360*((days/s.periodDays)%1)+peri,peri,s.ascendingNode],eccentricAnomaly);
  if(!s.poleRaDec)return local;
  const [ra,dec]=s.poleRaDec.map(v=>v*RAD);
  const pole=[Math.cos(ra)*Math.cos(dec),Math.sin(ra)*Math.cos(dec),Math.sin(dec)];
  const x=[-Math.sin(ra),Math.cos(ra),0]; // equator cross pole
  const y=[-Math.sin(dec)*Math.cos(ra),-Math.sin(dec)*Math.sin(ra),Math.cos(dec)]; // pole cross x
  const eq=pole.map((v,i)=>x[i]*local[0]+y[i]*local[1]+v*local[2]);
  return [eq[0],Math.cos(OBLIQUITY)*eq[1]+Math.sin(OBLIQUITY)*eq[2],-Math.sin(OBLIQUITY)*eq[1]+Math.cos(OBLIQUITY)*eq[2]];
}
export function moonOrbitRadius(world:World,t:number,expanded=false):number {
  const parent=WORLDS.find(w=>w.id===world.satellite!.parent)!;
  const lane=expanded?MOON_LANES[world.id]:parent.displayDiameter/2+.26+world.displayDiameter/2;
  return mix(world.satellite!.distanceKm/AU_KM,lane,t);
}
/** Display-only circularisation leaves the Keplerian angular phase unchanged. */
export function satelliteOffset(world:World,ms:number,t:number,expanded=false,eccentricAnomaly?:number):[number,number,number] {
  const real=satellitePositionAt(world,ms,eccentricAnomaly),r=Math.hypot(...real);
  const scale=mix(r,moonOrbitRadius(world,1,expanded),t)/r;
  return [real[0]*scale,real[2]*scale,-real[1]*scale];
}
export const BELTS = [
  { id:'asteroids', name:'Asteroid belt', inner:2.1, outer:3.3, halfWidth:.45, colour:'#ae9b7d', count:4200 },
  { id:'kuiper', name:'Kuiper belt', inner:30, outer:50, halfWidth:.85, colour:'#708fae', count:7600 },
];
export const mix = (a:number,b:number,t:number) => a+(b-a)*t;
export const daysSinceJ2000 = (ms:number) => (ms-J2000)/DAY_MS;
export function solveKepler(mean:number,e:number):number {
  const m=((mean+Math.PI)%TAU+TAU)%TAU-Math.PI;
  let E=m+e*Math.sin(m);
  for(let i=0;i<15;i++) { const delta=(E-e*Math.sin(E)-m)/(1-e*Math.cos(E)); E-=delta; if(Math.abs(delta)<1e-12)break; }
  return E;
}
export function elementsAt(world:World, ms:number):Six {
  if(world.kepler){
    const e=[...world.elements!] as Six;
    e[3]+=world.kepler.meanMotion*(ms-jdToMs(world.kepler.epochJD))/DAY_MS;
    return e;
  }
  const t=daysSinceJ2000(ms)/36525;
  const elements=world.elements!.map((v,i)=>v+world.rates![i]*t) as Six;
  if(world.corrections){
    const [b,c,s,f]=world.corrections;
    // The correction is in degrees; f*T is also a degree angle.
    elements[3]+=b*t*t+c*Math.cos(f*t*RAD)+s*Math.sin(f*t*RAD);
  }
  return elements;
}
/** Standard ecliptic XYZ in AU, with the Sun at the focus. */
export function positionFromElements(elements:Six, eccentricAnomaly?:number):[number,number,number] {
  const [a,e,i,L,peri,node]=elements;
  const E=eccentricAnomaly??solveKepler((L-peri)*RAD,e);
  const x=a*(Math.cos(E)-e), y=a*Math.sqrt(1-e*e)*Math.sin(E);
  const w=(peri-node)*RAD, n=node*RAD, inc=i*RAD;
  const cw=Math.cos(w),sw=Math.sin(w),cn=Math.cos(n),sn=Math.sin(n),ci=Math.cos(inc),si=Math.sin(inc);
  return [(cw*cn-sw*sn*ci)*x+(-sw*cn-cw*sn*ci)*y,
    (cw*sn+sw*cn*ci)*x+(-sw*sn+cw*cn*ci)*y, sw*si*x+cw*si*y];
}
export function positionAt(world:World,ms:number):[number,number,number] {
  return world.elements?positionFromElements(elementsAt(world,ms)):[0,0,0];
}
// Full obliquities (>90° for retrograde worlds) encode the rotation direction.
// Texture prime meridians and axial longitudes are illustrative.
export const spinAt = (world:World,ms:number) => ((daysSinceJ2000(ms)*24/world.spinHours)%1)*TAU;
export const diameterAt = (world:World,t:number) => mix(world.diameterKm/AU_KM,world.displayDiameter,t);
export const NORMAL_GAP = .8;
const order = ['sun','mercury','venus','earth','mars','asteroids','jupiter','saturn','uranus','neptune','pluto','kuiper'];
const planetFootprint=(w:World)=>w.displayDiameter*.5*(w.id==='saturn'?2.3:1);
export const MOON_GAP=.18;
export const MOON_LANES:Record<string,number>={};
for(const parent of WORLDS){
  let edge=planetFootprint(parent);
  for(const moon of ALL_MOONS.filter(m=>m.satellite!.parent===parent.id).sort((a,b)=>a.satellite!.distanceKm-b.satellite!.distanceKm)){
    MOON_LANES[moon.id]=edge+MOON_GAP+moon.displayDiameter/2;
    edge=MOON_LANES[moon.id]+moon.displayDiameter/2;
  }
}
export const ASTEROID_GAP=.08;
export const KUIPER_GAP=.12;
const expandedBeltWidths:Record<string,number>={},beltOffsets:Record<string,{region:string;offset:number}>={};
for(const [region,bodies,gap] of [['asteroids',ASTEROIDS,ASTEROID_GAP],['kuiper',KUIPER_BODIES,KUIPER_GAP]] as const){
  const halfWidth=(bodies.reduce((sum,w)=>sum+w.displayDiameter,0)+gap*(bodies.length-1))/2;
  expandedBeltWidths[region]=halfWidth;
  let edge=-halfWidth;
  for(const world of [...bodies].sort((a,b)=>a.elements![0]-b.elements![0])){
    beltOffsets[world.id]={region,offset:edge+world.displayDiameter/2};
    edge+=world.displayDiameter+gap;
  }
}
export const EXPANDED_BELT_HALF_WIDTH=expandedBeltWidths.asteroids;
export const beltHalfWidth=(id:string,expanded=false)=>expanded?expandedBeltWidths[id]:BELTS.find(b=>b.id===id)!.halfWidth;
export function footprint(id:string,expanded=false):number {
  const belt=BELTS.find(b=>b.id===id);
  if(belt)return beltHalfWidth(id,expanded);
  const w=WORLDS.find(w=>w.id===id)!;
  return Math.max(planetFootprint(w),...moonsFor(expanded).filter(m=>m.satellite!.parent===id).map(m=>moonOrbitRadius(m,1,expanded)+m.displayDiameter/2));
}
function makeRadii(expanded:boolean){
  const radii:Record<string,number>={sun:0};
  for(let i=1;i<order.length;i++)radii[order[i]]=radii[order[i-1]]+footprint(order[i-1],expanded)+NORMAL_GAP+footprint(order[i],expanded);
  return radii;
}
export const NORMAL_RADII=makeRadii(false),EXPANDED_RADII=makeRadii(true);
export const normalRadii=(expanded=false)=>expanded?EXPANDED_RADII:NORMAL_RADII;
export const smallBodyOrbitRadius=(id:string)=>EXPANDED_RADII[beltOffsets[id].region]+beltOffsets[id].offset;
export const asteroidOrbitRadius=smallBodyOrbitRadius;
/** Display-only distortion: retain true longitude/latitude and date-driven phase. */
export function displayPosition(real:[number,number,number],id:string,t:number,expanded=false):[number,number,number] {
  const r=Math.hypot(...real); if(!r)return [0,0,0];
  const lane=id in beltOffsets?smallBodyOrbitRadius(id):normalRadii(expanded)[id];
  const scale=mix(r,lane,t)/r;
  // Right-handed ecliptic -> Three.js Y-up. +Y is ecliptic north.
  return [real[0]*scale,real[2]*scale,-real[1]*scale];
}
const expandedPhysicalRadius=Math.max(52,...KUIPER_BODIES.map(w=>w.elements![0]*(1+w.elements![1])+w.diameterKm/AU_KM/2));
export const outerRadius = (t:number,expanded=false) => mix(expanded?expandedPhysicalRadius:52,normalRadii(expanded).kuiper+beltHalfWidth('kuiper',expanded),t);
export function advanceTime(ms:number,elapsedSeconds:number,yearsPerMinute:number):number {
  return Math.max(MIN_DATE,Math.min(MAX_DATE,ms+elapsedSeconds*yearsPerMinute*YEAR_DAYS*DAY_MS/60));
}
export function seeded(seed:number) { let n=seed>>>0; return ()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;}; }
