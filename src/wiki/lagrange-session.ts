import { LAGRANGE_SYSTEMS, type LagrangeName } from '../lagrange-model.ts';

export interface LagrangeOptions {system:string;point:LagrangeName;offsetPercent:number;kickPercent:number;orbits:number;custom:boolean;ratioLog:number}
export type LagrangeFrame='orbit'|'rotating'|'closeup';
export interface LagrangeSession {kind:'lagrange';options:LagrangeOptions;time:number;view?:LagrangeFrame;closeupSpan?:number;slowCloseup?:boolean;pinned?:{options:LagrangeOptions;time:number}}
export const lagrangeDefaults=():LagrangeOptions=>({system:'earth-moon',point:'L4',offsetPercent:.1,kickPercent:0,orbits:6,custom:false,ratioLog:Math.log10(81.300568)});
/** A different physical pair starts a new experiment, including its comparison. */
export function resetLagrangePair(session:LagrangeSession,system:string):LagrangeSession {
  const pair=LAGRANGE_SYSTEMS.find(p=>p.id===system);
  if(!pair)throw new RangeError('Unknown Lagrange pair.');
  return {...session,time:0,pinned:undefined,closeupSpan:undefined,options:{...session.options,system,custom:false,ratioLog:Math.max(0,Math.min(7,Math.log10(pair.primaryGM/pair.secondaryGM)))}};
}
