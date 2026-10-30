const attr=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const helpAttrs=(title:string,text:string)=>text?`data-help-title="${attr(title)}" data-help="${attr(text)}"`:'';
export const helpButton=(title:string,text:string)=>text?`<button type="button" class="science-help-button" aria-label="About ${attr(title)}" ${helpAttrs(title,text)}>?</button>`:'';
export const FIELD_HELP:Record<string,string>={
  'escape-world':'Choose the source of gravity. Changing worlds keeps the speed thumb in the same position: the same fraction of that world’s escape speed, with a new value in km/s. Height and mass stay unchanged. Each world uses its Launch Lab gravity and radius.',
  'escape-height':'Height above the reference surface. Starting higher lowers the escape threshold. Your speed in km/s stays unchanged unless it exceeds the slider’s new limit of twice escape speed. For the Sun and gas giants the reference platform is fictional.',
  'escape-speed':'Speed immediately after one outward push, then the engine is off. The slider runs from zero to twice this world’s escape speed at the selected height. Its midpoint is exactly escape speed. Below that the probe returns; at or above it, the probe can travel arbitrarily far.',
  'escape-mass':'Probe mass changes the energy needed, but not the escape speed. Doubling mass doubles both kinetic energy and the energy needed to escape.',
  'lagrange-system':'Lagrange points belong to a pair. Choosing a different pair starts at time zero, clears the old comparison and restores the new pair’s real masses. The selected point, nudge, kick and duration stay the same. Mass ratio determines whether L4 and L5 are stable.',
  'lagrange-point':'Choose a balance point. L1–L3 lie on the line through the worlds and are unstable. L4 leads and L5 trails the companion. Their stability depends on mass ratio.',
  'lagrange-offset':'Move the probe to the right of its balance point before release. 0.1% means 0.001 times the separation between the worlds: 384.4 km for Earth–Moon. This is along the rotating x-axis, not a fraction of the distance from the point to a world. This tests how a small positioning error develops.',
  'lagrange-kick':'Give the probe an initial upward velocity relative to the rotating frame. A negative value kicks downwards. 1% is 0.01 times the worlds’ relative circular orbital speed. Zero kick means initially moving with the frame, not standing still in space.',
  'lagrange-duration':'How long to compute the experiment. One pair orbit is one complete revolution of the worlds about their shared centre of mass. Longer runs can expose slow instabilities.',
  'lagrange-ratio':'Change the heavier-to-lighter mass ratio. L4 and L5 are linearly stable above about 25:1. Below that, even these triangular points are unstable. The invented system keeps the chosen pair’s distance and radii.',
  'lagrange-time':'Inspect the already computed trajectory. Dragging changes the moment being shown, not the physics. The bright trace is the replay so far; the faint trace is the complete prediction.',
  'telescope-type':'A refractor focuses with a lens. A Newtonian reflector uses a curved primary mirror and a small diagonal mirror to direct the image to a side eyepiece.',
  'telescope-aperture':'Diameter of the collecting lens or mirror. A larger aperture collects more light and narrows the ideal diffraction pattern. Double the diameter for four times the area.',
  'telescope-focal':'Distance over which the main lens or mirror brings parallel light to focus. Dividing this by eyepiece focal length gives the magnification.',
  'telescope-eyepiece':'A shorter eyepiece gives greater magnification. It enlarges the image, but cannot narrow the angular diffraction pattern or recover detail the aperture did not resolve.',
  'telescope-separation':'Angular distance between two equally bright stars. One arcsecond is 1/3600 of a degree. Compare this separation with the diffraction patterns and Rayleigh reference.',
  'telescope-wavelength':'Colour of the ideal monochromatic light. Longer wavelengths produce wider diffraction patterns through the same aperture.',
  'telescope-obstruction':'Secondary-mirror diameter divided by primary diameter. A 20% diameter obstruction blocks 4% of the area and changes the diffraction rings. Applies only to the reflector.',
};
let sequence=0;
/** One delegated tooltip per mounted tool, kept in the dialog's top layer.
 * Hover, focus and a tappable help button share the same explanation. */
export function mountScienceHelp(root:HTMLElement){
  const abort=new AbortController(),signal=abort.signal;
  const tooltip=document.createElement('div');tooltip.id=`science-tooltip-${++sequence}`;tooltip.className='science-tooltip';tooltip.role='tooltip';tooltip.hidden=true;
  tooltip.innerHTML='<strong></strong><span></span>';(root.closest('dialog')??root).append(tooltip);
  let active:HTMLElement|SVGElement|undefined,sticky=false,oldDescription:string|null=null;
  const hide=()=>{if(active){if(oldDescription===null)active.removeAttribute('aria-describedby');else active.setAttribute('aria-describedby',oldDescription);}active=undefined;sticky=false;tooltip.hidden=true;};
  function show(target:HTMLElement|SVGElement){
    if(active!==target){hide();active=target;oldDescription=target.getAttribute('aria-describedby');target.setAttribute('aria-describedby',[oldDescription,tooltip.id].filter(Boolean).join(' '));}
    tooltip.querySelector('strong')!.textContent=target.dataset.helpTitle??target.getAttribute('aria-label')??'Explore';tooltip.querySelector('span')!.textContent=target.dataset.help??'';tooltip.hidden=false;
    const box=target.getBoundingClientRect(),tip=tooltip.getBoundingClientRect();
    tooltip.style.left=`${Math.max(12,Math.min(innerWidth-tip.width-12,box.left+box.width/2-tip.width/2))}px`;
    tooltip.style.top=`${box.bottom+tip.height+12<innerHeight?box.bottom+9:Math.max(12,box.top-tip.height-9)}px`;
  }
  const targetFor=(target:EventTarget|null)=>{
    const element=target instanceof Element?target.closest<HTMLElement|SVGElement>('[data-help]'):null;
    return element?.dataset.helpSuppressed==='true'?null:element;
  };
  root.addEventListener('pointerover',event=>{const target=targetFor(event.target);if(target&&!sticky)show(target);},{signal});
  root.addEventListener('pointerout',event=>{if(!sticky&&active&&!active.contains(event.relatedTarget as Node))hide();},{signal});
  root.addEventListener('focusin',event=>{const target=targetFor(event.target);if(target){sticky=false;show(target);}},{signal});
  root.addEventListener('focusout',event=>{if(!sticky&&active&&!active.contains(event.relatedTarget as Node))hide();},{signal});
  root.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLElement>('.science-help-button');if(button){event.preventDefault();if(active===button&&sticky)hide();else{show(button);sticky=true;}}else if((event.target as Element).closest('button'))hide();},{signal});
  root.addEventListener('science-dismiss-help',hide,{signal});
  document.addEventListener('pointerdown',event=>{if(active&&!active.contains(event.target as Node))hide();},{signal});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();event.stopPropagation();hide();}},{signal,capture:true});
  root.closest('.atlas-main')?.addEventListener('scroll',hide,{signal,passive:true});window.addEventListener('resize',hide,{signal});
  const defaultHelp:Record<string,string>={
    'data-play':'Run or pause the computed probe experiment. Replay follows exactly the same trajectory. Scrubbing changes only the moment being shown, not the physics.',
    'data-reset':'Restore this tool’s starting settings and clear its pinned comparison.',
    'data-pin':'Keep these settings as an orange comparison. For the probe, this also keeps the part of the trajectory you have already inspected. Change one parameter to make a useful comparison.',
  };
  for(const [selector,text] of Object.entries(defaultHelp))for(const button of root.querySelectorAll<HTMLButtonElement>(`button[${selector}]`))if(!button.dataset.help){button.dataset.help=text;button.dataset.helpTitle=button.textContent??'';}
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-speed-factor]')){button.dataset.helpTitle=button.textContent??'';button.dataset.help='Set the starting speed to this fraction of the current world’s escape speed. Try all three presets and follow where the curve reaches zero—or keeps a positive speed at infinity.';}
  return ()=>{hide();abort.abort();tooltip.remove();};
}
