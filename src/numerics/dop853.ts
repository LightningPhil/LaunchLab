import { A, B, E3, E5, D } from './dop853-coefficients.ts';

export interface DenseStep {start:number;end:number;initial:number[];coefficients:number[][]}
export type Derivative=(state:readonly number[])=>number[];
const sum=(weights:number[],stages:number[][],component:number)=>weights.reduce((value,w,j)=>value+(w? w*stages[j][component]:0),0);

/** Embedded order-8 DOP853 with its order-7 continuous extension. Numerical
 * scheme adapted from SciPy (BSD-3-Clause, see THIRD_PARTY_NOTICES.txt).
 * Local error controls all state components, including small velocities. */
export function dop853Trial(derivative:Derivative,initial:number[],h:number,rtol:number,atol:number){
  const stages:number[][]=[derivative(initial)];
  for(let i=1;i<12;i++)stages.push(derivative(initial.map((v,k)=>v+h*sum(A[i].slice(0,i),stages,k))));
  const value=initial.map((v,k)=>v+h*sum(B,stages,k));
  stages.push(derivative(value));
  let error5=0,error3=0;
  for(let k=0;k<initial.length;k++){
    const scale=atol+rtol*Math.max(Math.abs(initial[k]),Math.abs(value[k]));
    error5+=(sum(E5,stages,k)/scale)**2;error3+=(sum(E3,stages,k)/scale)**2;
  }
  const error=error5===0&&error3===0?0:Math.abs(h)*error5/Math.sqrt((error5+.01*error3)*initial.length);
  const dense=(start:number):DenseStep=>{
    for(let i=13;i<16;i++)stages.push(derivative(initial.map((v,k)=>v+h*sum(A[i].slice(0,i),stages,k))));
    const delta=value.map((v,k)=>v-initial[k]);
    return {start,end:start+h,initial,coefficients:[delta,delta.map((d,k)=>h*stages[0][k]-d),delta.map((d,k)=>2*d-h*(stages[12][k]+stages[0][k])),...D.map(row=>initial.map((_,k)=>h*sum(row,stages,k)))]};
  };
  return {value,error,dense};
}

export function denseValue(step:DenseStep,time:number):number[]{
  const x=Math.max(0,Math.min(1,(time-step.start)/(step.end-step.start)));
  const value=step.initial.map(()=>0);
  for(let i=step.coefficients.length-1;i>=0;i--){
    const factor=(step.coefficients.length-1-i)%2===0?x:1-x;
    for(let k=0;k<value.length;k++)value[k]=(value[k]+step.coefficients[i][k])*factor;
  }
  return value.map((v,k)=>v+step.initial[k]);
}
