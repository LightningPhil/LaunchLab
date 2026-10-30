export type TelescopeType='refractor'|'reflector';
export interface TelescopeOptions {type:TelescopeType;apertureMm:number;focalMm:number;eyepieceMm:number;wavelengthNm:number;obstruction:number;separationArcsec:number}
export const TELESCOPE_DEFAULTS:TelescopeOptions={type:'refractor',apertureMm:100,focalMm:1000,eyepieceMm:20,wavelengthNm:550,obstruction:.2,separationArcsec:2};
const ARCSEC_PER_RADIAN=180*3600/Math.PI;
export function telescopeExperiment(options:TelescopeOptions){
  const {apertureMm:d,focalMm:f,eyepieceMm:e,wavelengthNm:w,separationArcsec:s}=options;
  if(![d,f,e,w,s,options.obstruction].every(Number.isFinite)||!(d>0&&f>0&&e>0&&w>0&&s>=0)||options.obstruction<0||options.obstruction>=1)throw new RangeError('Invalid telescope experiment.');
  const obstruction=options.type==='reflector'?options.obstruction:0;
  return {magnification:f/e,focalRatio:f/d,exitPupilMm:d*e/f,
    collectingAreaMm2:Math.PI*(d/2)**2*(1-obstruction**2),obstruction,
    // Reference Rayleigh angle of an unobstructed circular aperture. An annulus
    // has a different PSF, which is calculated below, not this reference rule.
    rayleighArcsec:1.22*w*1e-6/d*ARCSEC_PER_RADIAN};
}
/** J1 power series suffices for |x| <= 16. For larger x use the convergent
 * leading asymptotic terms, avoiding cancellation of huge alternating terms. */
export function besselJ1(x:number):number {
  const ax=Math.abs(x);
  if(ax>16){
    const angle=ax-3*Math.PI/4,z=1/(8*ax);
    return Math.sign(x)*Math.sqrt(2/(Math.PI*ax))*((1+15*z*z/2-14175*z**4/24)*Math.cos(angle)
      -(3*z-315*z**3/6)*Math.sin(angle));
  }
  let term=x/2,sum=term;
  for(let k=1;k<70;k++){term*=-x*x/(4*k*(k+1));sum+=term;if(Math.abs(term)<1e-16)break;}
  return sum;
}
/** Fraunhofer intensity for an ideal circular or centrally obscured aperture.
 * Equal-brightness incoherent stars add intensities, not wave amplitudes. */
export function diffractionIntensity(options:TelescopeOptions,angleArcsec:number):number {
  const epsilon=options.type==='reflector'?options.obstruction:0;
  const x=Math.PI*options.apertureMm/(options.wavelengthNm*1e-6)*angleArcsec/ARCSEC_PER_RADIAN;
  if(Math.abs(x)<1e-5)return 1;
  const amplitude=2*(besselJ1(x)-epsilon*besselJ1(epsilon*x))/(x*(1-epsilon**2));
  return amplitude*amplitude;
}
export const doubleStarIntensity=(options:TelescopeOptions,angleArcsec:number)=>
  diffractionIntensity(options,angleArcsec-options.separationArcsec/2)+diffractionIntensity(options,angleArcsec+options.separationArcsec/2);
