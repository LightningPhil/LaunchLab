import { ENVIRONMENTS } from '../environment.ts';
export interface EscapeOptions {world:string;altitudeKm:number;speedKmS:number;massKg:number}
export const ESCAPE_DEFAULTS:EscapeOptions={world:'earth',altitudeKm:0,speedKmS:10,massKg:1000};
/** The teaching control spans 0–200% of this world's local escape speed. */
export const maximumStartingSpeed=(options:EscapeOptions)=>2*escapeExperiment(options).escapeSpeed/1000;
export function retargetEscapeWorld(options:EscapeOptions,world:string):EscapeOptions {
  const fraction=Math.max(0,Math.min(1,options.speedKmS/maximumStartingSpeed(options)));
  const next={...options,world};
  return {...next,speedKmS:fraction*maximumStartingSpeed(next)};
}
export function escapeExperiment(options:EscapeOptions){
  const world=ENVIRONMENTS.find(w=>w.name===options.world);
  const {altitudeKm,speedKmS,massKg}=options;
  if(!world||![altitudeKm,speedKmS,massKg].every(Number.isFinite)||altitudeKm<0||speedKmS<0||!(massKg>0))throw new RangeError('Invalid escape experiment.');
  const gm=world.gravity*world.radius**2,radius=world.radius+altitudeKm*1000,speed=speedKmS*1000;
  const escapeSpeed=Math.sqrt(2*gm/radius),specificEnergy=speed*speed/2-gm/radius;
  const atThreshold=Math.abs(specificEnergy)<gm/radius*1e-12;
  const outcome=atThreshold?'threshold':specificEnergy<0?'returns':'escapes';
  return {world,gm,radius,escapeSpeed,circularSpeed:escapeSpeed/Math.SQRT2,specificEnergy,
    kineticEnergy:massKg*speed*speed/2,bindingEnergy:massKg*gm/radius,
    outcome,maximumAltitudeKm:outcome==='returns'?Math.max(altitudeKm,(-gm/specificEnergy-world.radius)/1000):null,
    excessSpeed:outcome==='escapes'?Math.sqrt(2*specificEnergy):0};
}
/** Outward radial coast only; null means the rocket cannot reach that radius. */
export function coastSpeedAtRadius(options:EscapeOptions,radius:number):number|null {
  const result=escapeExperiment(options);
  if(radius<result.radius)return null;
  const squared=2*(result.specificEnergy+result.gm/radius);
  return squared< -1e-8?null:Math.sqrt(Math.max(0,squared));
}
/** Compact distance coordinate u = 1 - r0/r. Infinity is exactly u=1;
 * a bound radial coast instead ends at a finite u<1 and zero speed. */
export function escapeCoastToInfinity(options:EscapeOptions,samples=240){
  if(!Number.isInteger(samples)||samples<2||samples>2000)throw new RangeError('Invalid coast sample count.');
  const result=escapeExperiment(options),ratio=options.speedKmS*1000/result.escapeSpeed;
  const end=result.outcome==='returns'?Math.min(1,ratio*ratio):1;
  const points=Array.from({length:samples+1},(_,i)=>{
    const u=end*i/samples;
    const squared=result.outcome==='threshold'?result.escapeSpeed**2*(1-u):(options.speedKmS*1000)**2-result.escapeSpeed**2*u;
    return {u,speed:Math.sqrt(Math.max(0,squared))};
  });
  if(result.outcome!=='escapes')points[points.length-1].speed=0;
  return {points,endsAtInfinity:result.outcome!=='returns',turningRadiusRatio:result.outcome==='returns'?1/(1-end):null};
}
