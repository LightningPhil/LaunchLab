import './science-labs.css';
import { mountScienceHelp } from './science-help.ts';
import { escapeLabMarkup, mountEscapeLab, type EscapeSession } from './escape-lab.ts';
import { lagrangeLabMarkup, mountLagrangeLab, type LagrangeSession } from './lagrange-lab.ts';
import { telescopeLabMarkup, mountTelescopeLab, type TelescopeSession } from './telescope-lab.ts';
export type ScienceLabSession=EscapeSession|LagrangeSession|TelescopeSession;
export type ScienceLabKind=ScienceLabSession['kind'];
export const scienceLabMarkup=(kind:ScienceLabKind)=>kind==='escape'?escapeLabMarkup():kind==='lagrange'?lagrangeLabMarkup():telescopeLabMarkup();
export function mountScienceLab(root:HTMLElement,kind:ScienceLabKind,saved?:ScienceLabSession){
  const lab=kind==='escape'?mountEscapeLab(root,saved?.kind==='escape'?saved:undefined)
    :kind==='lagrange'?mountLagrangeLab(root,saved?.kind==='lagrange'?saved:undefined)
    :mountTelescopeLab(root,saved?.kind==='telescope'?saved:undefined);
  const disposeHelp=mountScienceHelp(root);
  return {dispose:()=>{disposeHelp();return lab.dispose();}};
}
