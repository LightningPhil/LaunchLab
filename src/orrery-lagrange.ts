import { WORLDS, MOONS, AU_KM, positionAt, displayPosition, satelliteOffset, footprint, type World } from './orrery-model.ts';
import { massFraction, placedLagrangePoints, type LagrangeSystem, type Vec3 } from './lagrange-model.ts';

const worlds=new Map([...WORLDS,...MOONS].map(w=>[w.id,w]));
export function worldPositionAt(id:string,ms:number,amount:number,expanded=false):Vec3 {
  const world=worlds.get(id)!;
  if(!world.satellite)return displayPosition(positionAt(world,ms),id,amount,expanded);
  const parent=worldPositionAt(world.satellite.parent,ms,amount,expanded),offset=satelliteOffset(world,ms,amount,expanded);
  return parent.map((n,i)=>n+offset[i]) as Vec3;
}
export function orreryLagrangePoints(system:LagrangeSystem,ms:number,amount:number,expanded=false){
  const primary=worldPositionAt(system.primary,ms,0),secondary=worldPositionAt(system.secondary,ms,0);
  const relativeAt=(time:number)=>{
    const a=worldPositionAt(system.primary,time,0),b=worldPositionAt(system.secondary,time,0);
    return b.map((n,i)=>n-a[i]) as Vec3;
  };
  const before=relativeAt(ms-60000),after=relativeAt(ms+60000),relativeVelocity=after.map((n,i)=>n-before[i]) as Vec3;
  const drawnPrimary=worldPositionAt(system.primary,ms,amount,expanded),drawnSecondary=worldPositionAt(system.secondary,ms,amount,expanded);
  const a=worldPositionAt(system.primary,ms,1,expanded),b=worldPositionAt(system.secondary,ms,1,expanded);
  const evenSeparation=Math.hypot(...a.map((n,i)=>n-b[i]));
  const secondaryWorld=worlds.get(system.secondary) as World,primaryWorld=worlds.get(system.primary) as World;
  const secondaryFootprint=secondaryWorld.satellite?secondaryWorld.displayDiameter/2:footprint(secondaryWorld.id,expanded);
  const evenClearance=Math.min(secondaryFootprint+.12,evenSeparation-primaryWorld.displayDiameter/2-.06);
  return placedLagrangePoints(massFraction(system),{primary,secondary,relativeVelocity,drawnPrimary,drawnSecondary,evenSeparation,evenClearance},amount)
    .map(point=>({...point,companionDistanceKm:point.companionDistance*AU_KM}));
}
