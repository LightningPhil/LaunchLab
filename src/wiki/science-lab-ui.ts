export const number=(value:number,digits=1)=>value.toLocaleString(undefined,{maximumFractionDigits:digits});
export const n=(value:number)=>Number(value.toFixed(3));
export const option=(value:string,label:string)=>`<option value="${value}">${label}</option>`;
export function rangeField(id:string,label:string,min:number,max:number,step:number,value:number){
  const help=FIELD_HELP[id]??'';
  return `<div class="science-field"><div class="science-field-name"><label for="${id}">${label}</label>${helpButton(label,help)}</div><output data-value="${id}" for="${id}"></output><input id="${id}" aria-label="${label}" ${helpAttrs(label,help)} type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}
export function selectField(id:string,label:string,options:string){const help=FIELD_HELP[id]??'';return `<div class="science-field"><div class="science-field-name"><label for="${id}">${label}</label>${helpButton(label,help)}</div><select id="${id}" aria-label="${label}" ${helpAttrs(label,help)}>${options}</select></div>`;}
export function metric(label:string,value:string,help=''){return `<div ${helpAttrs(label,help)} ${help?'tabindex="0"':''}><dt>${label}</dt><dd>${value}</dd></div>`;}
export function output(root:HTMLElement,id:string,value:string){
  root.querySelector<HTMLOutputElement>(`[data-value="${id}"]`)!.textContent=value;
  root.querySelector<HTMLInputElement>(`#${id}`)!.setAttribute('aria-valuetext',value);
}
export function plotGrid(x:number,y:number,width:number,height:number){
  return [0,.25,.5,.75,1].map(f=>`<path class="science-grid" d="M${x} ${n(y+f*height)}h${width}M${n(x+f*width)} ${y}v${height}"/>`).join('');
}
import { FIELD_HELP, helpAttrs, helpButton } from './science-help.ts';
