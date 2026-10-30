import { TELESCOPE_DEFAULTS, telescopeExperiment, doubleStarIntensity, type TelescopeOptions } from './telescope-model.ts';
import { metric, number, n, output, rangeField, selectField, plotGrid } from './science-lab-ui.ts';
import { helpAttrs } from './science-help.ts';

export interface TelescopeSession {kind:'telescope';options:TelescopeOptions;pinned?:TelescopeOptions}
export function telescopeLabMarkup(){return `<section class="science-lab science-telescope" aria-labelledby="telescope-lab-title">
  <header class="science-lab-head"><div><p class="atlas-kicker">TRY IT / LIGHT AND DETAIL</p><h2 id="telescope-lab-title">Build a telescope. Split two stars.</h2></div><span class="science-lab-badge">Optics bench</span></header>
  <div class="science-workbench"><figure class="science-figure"><svg data-telescope-figure viewBox="0 0 680 510" role="img" tabindex="0" aria-label="Telescope light path and two-star diffraction profiles" ${helpAttrs('Follow light, then compare detail','The upper drawing shows the light path schematically. The lower graph adds the diffraction patterns of two equal stars on a fixed angular scale. Narrower peaks reveal finer detail; magnification alone does not narrow them. Peaks are normalized, so compare collecting area separately.')}></svg><figcaption>Optical layout: schematic, not to scale. Star profiles: the same angular scale, normalised per star. Teal is current; orange is the pinned telescope. Collecting area is compared separately.</figcaption></figure>
  <div class="science-controls">${selectField('telescope-type','Main collecting optic','<option value="refractor">Refractor · lens</option><option value="reflector">Newtonian reflector · mirrors</option>')}
  ${rangeField('telescope-aperture','Aperture diameter',20,500,5,100)}${rangeField('telescope-focal','Objective focal length',200,2500,25,1000)}${rangeField('telescope-eyepiece','Eyepiece focal length',4,60,1,20)}${rangeField('telescope-separation','Star separation',.2,8,.1,2)}
  <details class="science-extra"><summary>Wavelength & obstruction</summary>${rangeField('telescope-wavelength','Wavelength',400,750,10,550)}${rangeField('telescope-obstruction','Secondary diameter / aperture',.1,.4,.01,.2)}<p>The obstruction control applies to the reflector. No central obstruction is used for the refractor.</p></details>
  <div class="science-actions"><button type="button" data-pin>Pin comparison</button><button type="button" data-reset>Reset</button></div><p class="science-comparison" data-comparison role="status"></p></div></div>
  <dl class="science-metrics" data-telescope-metrics></dl><p class="science-answer" data-telescope-answer role="status"></p>
  <p class="science-challenge"><strong>Try this:</strong> Pin a 100 mm telescope, then double its aperture. Next change only the eyepiece. Which change narrows the stars’ diffraction patterns?</p>
  <details class="science-model-note"><summary>What does this experiment assume?</summary><p>Perfect monochromatic optics and two equally bright, incoherent point sources. The profile is the circular- or annular-aperture Fraunhofer diffraction pattern. It includes the secondary’s central obstruction, but omits its supports, coatings, alignment errors, lens colour fringes and atmospheric seeing. The Rayleigh reading is an unobstructed-aperture reference; an obstructed mirror has a different pattern.</p></details></section>`;}

function rays(o:TelescopeOptions){
  const cy=143,f=330,r=Math.max(20,Math.min(72,f*o.apertureMm/(2*o.focalMm))),eye=Math.max(5,Math.min(28,f*o.eyepieceMm/o.focalMm));
  if(o.type==='refractor'){
    const x=180,focus=x+f,ocular=focus+eye;
    return `<path d="M30 ${cy}H649" class="science-optical-axis"/><ellipse cx="${x}" cy="${cy}" rx="9" ry="${r+5}" class="science-lens"/>
      ${[-1,-.6,.6,1].map(k=>{const h=k*r,y=cy-h*eye/f;return `<path class="science-ray" d="M30 ${n(cy+h)}H${x}L${focus} ${cy}L${ocular} ${n(y)}H649"/>`;}).join('')}
      <ellipse cx="${ocular}" cy="${cy}" rx="4" ry="18" class="science-lens"/><circle cx="${focus}" cy="${cy}" r="3" class="science-focus"/>
      <text x="${x}" y="${n(cy+r+30)}" text-anchor="middle">Objective lens</text><text x="${focus-8}" y="${cy+40}" text-anchor="end">Real image</text><text x="${ocular+12}" y="${cy-32}">Eyepiece</text>
      <text x="340" y="233" text-anchor="middle" class="science-svg-muted">Lens bends light → image → eyepiece magnifies</text>`;
  }
  const primary=595,focus=primary-f,sx=focus+f*o.obstruction*.65,fy=cy+focus-sx,ey=fy-eye,half=r*o.obstruction;
  return `<path d="M30 ${cy}H${primary}" class="science-optical-axis"/>
    ${[-1,-.6,.6,1].map(k=>{
      const h=k*r,px=primary-h*h/(4*f),py=cy+h,dx=focus-px,dy=cy-py;
      const t=(px-py-sx+cy)/(dy-dx),mx=px+t*dx,my=py+t*dy,ex=mx+(ey-my)*(sx-mx)/(fy-my);
      return `<path class="science-ray" d="M30 ${n(py)}H${n(px)}L${n(mx)} ${n(my)}L${n(ex)} ${n(ey)}V34"/>`;
    }).join('')}
    <path class="science-mirror" d="M${n(primary-r*r/(4*f))} ${n(cy-r)}Q${n(primary+r*r/(4*f))} ${cy} ${n(primary-r*r/(4*f))} ${n(cy+r)}"/>
    <path class="science-mirror" d="M${n(sx-half)} ${n(cy-half)}l${n(half*2)} ${n(half*2)}"/>
    <ellipse cx="${n(sx)}" cy="${n(ey)}" rx="18" ry="4" class="science-lens"/><circle cx="${n(sx)}" cy="${n(fy)}" r="3" class="science-focus"/>
    <text x="${primary-6}" y="${n(cy+r+28)}" text-anchor="end">Primary mirror</text><text x="${n(sx+half+12)}" y="${cy+20}">Secondary</text><text x="${n(sx+25)}" y="${n(ey-7)}">Eyepiece</text>
    <text x="340" y="233" text-anchor="middle" class="science-svg-muted">Curved mirror focuses → flat mirror folds the light</text>`;
}
function figure(o:TelescopeOptions,pinned?:TelescopeOptions){
  const r=telescopeExperiment(o),gx=62,gy=292,w=566,h=156;
  const curve=(p:TelescopeOptions)=>Array.from({length:801},(_,i)=>{
    const angle=-8+16*i/800,intensity=doubleStarIntensity(p,angle);
    return `${i?'L':'M'}${n(gx+w*i/800)} ${n(gy+h*(1-intensity/2.1))}`;
  }).join('');
  return `<title>${o.type==='refractor'?'Refracting':'Reflecting'} telescope: ${number(r.magnification,1)} times magnification</title><desc>Two stars separated by ${number(o.separationArcsec,1)} arcseconds, through a ${o.apertureMm} millimetre aperture. The ideal unobstructed Rayleigh reference is ${number(r.rayleighArcsec,2)} arcseconds.</desc>
    <text x="28" y="27" class="science-svg-kicker">${o.type==='refractor'?'REFRACTOR / THROUGH A LENS':'NEWTONIAN REFLECTOR / A FOLDED LIGHT PATH'}</text>${rays(o)}
    <text x="62" y="271">Two-star brightness profile / normalised intensity</text>${plotGrid(gx,gy,w,h)}
    ${[-8,-4,0,4,8].map(a=>`<text x="${n(gx+(a+8)/16*w)}" y="473" text-anchor="middle">${a}</text>`).join('')}
    <text x="345" y="501" text-anchor="middle">Angle on the sky / arcseconds</text><text x="50" y="${gy+h+4}" text-anchor="end">0</text><text x="50" y="${n(gy+h*(1-1/2.1)+4)}" text-anchor="end">1</text>
    ${pinned?`<path d="${curve(pinned)}" class="science-pinned-curve"/>`:''}<path d="${curve(o)}" class="science-current-curve"/>`;
}
export function mountTelescopeLab(root:HTMLElement,saved?:TelescopeSession){
  let s:TelescopeSession=saved?{...saved,options:{...saved.options},pinned:saved.pinned?{...saved.pinned}:undefined}:{kind:'telescope',options:{...TELESCOPE_DEFAULTS}};
  const abort=new AbortController(),signal=abort.signal,find=<T extends Element=HTMLElement>(q:string)=>root.querySelector<T>(q)!;
  const bindings={aperture:'apertureMm',focal:'focalMm',eyepiece:'eyepieceMm',wavelength:'wavelengthNm',obstruction:'obstruction',separation:'separationArcsec'} as const;
  function sync(){find<HTMLSelectElement>('#telescope-type').value=s.options.type;for(const [id,key] of Object.entries(bindings))find<HTMLInputElement>(`#telescope-${id}`).value=String(s.options[key]);}
  function render(){
    const o=s.options,r=telescopeExperiment(o);output(root,'telescope-aperture',`${o.apertureMm} mm`);output(root,'telescope-focal',`${o.focalMm} mm`);output(root,'telescope-eyepiece',`${o.eyepieceMm} mm`);output(root,'telescope-separation',`${number(o.separationArcsec,1)} arcsec`);output(root,'telescope-wavelength',`${o.wavelengthNm} nm`);output(root,'telescope-obstruction',`${number(o.obstruction*100,0)}% of diameter`);
    find<HTMLInputElement>('#telescope-obstruction').disabled=o.type!=='reflector';
    find('[data-telescope-figure]').innerHTML=figure(o,s.pinned);
    find('[data-telescope-metrics]').innerHTML=metric('Magnification',`${number(r.magnification,1)}×`,'How much larger the angle appears through the telescope. Objective focal length divided by eyepiece focal length; it does not set angular resolution.')+metric('Collecting area',`${number(r.collectingAreaMm2/100,1)} cm²`,'The light-gathering area of the main optic, subtracting the secondary obstruction for a reflector. Coating losses are omitted.')+metric('Rayleigh reference',`${number(r.rayleighArcsec,2)} arcsec`,'The reference separation 1.22 times wavelength divided by aperture diameter, for an unobstructed circular pupil. The reflector’s plotted diffraction includes its obstruction separately.')+metric('Exit pupil',`${number(r.exitPupilMm,2)} mm`,'Width of the outgoing light beam: aperture divided by magnification. If wider than your eye’s pupil, some light is lost.');
    find('[data-telescope-answer]').innerHTML=`<strong>${o.apertureMm} mm · f/${number(r.focalRatio,1)}</strong><span>${o.separationArcsec>=r.rayleighArcsec?'The stars’ separation meets the unobstructed Rayleigh reference.':'The stars are closer than the unobstructed Rayleigh reference.'} ${o.type==='reflector'?'The plotted annular pattern also includes the secondary obstruction.':''} Magnification enlarges the image; it does not narrow these angular profiles.</span>`;
    find('[data-comparison]').textContent=s.pinned?`Pinned: ${s.pinned.apertureMm} mm ${s.pinned.type}, ${s.pinned.focalMm} mm objective, ${s.pinned.eyepieceMm} mm eyepiece. Current collecting area is ${number(r.collectingAreaMm2/telescopeExperiment(s.pinned).collectingAreaMm2,2)}× the pinned area.`:'Pin a telescope, then change one parameter. Both star profiles use the same angular scale.';
  }
  root.addEventListener('input',event=>{
    const input=event.target as HTMLInputElement;
    if(input.id==='telescope-type')s.options.type=input.value as TelescopeOptions['type'];
    else {const key=bindings[input.id.replace('telescope-','') as keyof typeof bindings];if(!key)return;s.options[key]=Number(input.value);}
    render();
  },{signal});
  root.addEventListener('click',event=>{
    const button=(event.target as Element).closest('button');if(!button)return;
    if(button.hasAttribute('data-pin'))s.pinned={...s.options};
    else if(button.hasAttribute('data-reset')){s={kind:'telescope',options:{...TELESCOPE_DEFAULTS}};sync();}else return;
    render();
  },{signal});
  sync();render();return {dispose:()=>{abort.abort();return s;}};
}
