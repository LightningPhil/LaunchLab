/** Refresh offline orbital data. Run with Node 24 from the repository root.
 * JPL requests are deliberately serial: https://ssd-api.jpl.nasa.gov/doc/
 * --cached rebuilds from the checked-in source snapshot without network access.
 */
import fs from 'node:fs/promises';
const moonNames = [
  'Moon','Phobos','Deimos',
  'Metis','Adrastea','Amalthea','Thebe','Io','Europa','Ganymede','Callisto','Himalia',
  'Pan','Atlas','Prometheus','Pandora','Epimetheus','Janus','Mimas','Enceladus','Tethys','Dione','Helene','Rhea','Titan','Hyperion','Iapetus','Phoebe',
  'Miranda','Ariel','Umbriel','Titania','Oberon',
  'Naiad','Thalassa','Despina','Galatea','Larissa','Proteus','Triton','Nereid',
  'Charon','Styx','Nix','Kerberos','Hydra',
];
const asteroidIds = [1,2,3,4,7,10,15,16,24,31,52,87,511,704,951,243];
const kuiperIds = [136108,136472,50000,90482,20000,120347,174567,28978,486958];
// SBDB often has no diameter for TNOs. Keep measured size supplements explicit,
// with their primary sources; never infer a size from absolute magnitude alone.
const kuiperSizes = {
  136108:{diameter:1430,url:'https://ssd.jpl.nasa.gov/planets/phys_par.html',note:'Twice JPL mean radius (volume-equivalent sphere).'},
  136472:{diameter:1428,url:'https://ssd.jpl.nasa.gov/planets/phys_par.html',note:'Twice JPL mean radius.'},
  50000:{diameter:1070,url:'https://arxiv.org/abs/1305.0449',note:'Fornasier et al. 2013, primary diameter; satellite excluded.'},
  90482:{diameter:917,url:'https://arxiv.org/abs/1305.0449',note:'Fornasier et al. 2013, primary diameter; satellite excluded.'},
  120347:{diameter:854,url:'https://arxiv.org/abs/1305.0449',note:'Fornasier et al. 2013, primary diameter; satellite excluded.'},
  174567:{diameter:740,url:'https://arxiv.org/abs/2008.04818',note:'Souami et al. 2020, area-equivalent diameter; spherical approximation.'},
  28978:{diameter:696.78,url:'https://arxiv.org/abs/2601.09639',note:'Kilic et al. 2026, area-equivalent diameter; spherical approximation.'},
  486958:{diameter:18,url:'https://www.sciencedirect.com/science/article/pii/S0019103520301147',note:'Hofgartner et al. 2021, volume-equivalent diameter; contact-binary shape not resolved.'},
};
const urls = {
  moons:'https://ssd.jpl.nasa.gov/sats/elem/',
  sizes:'https://ssd.jpl.nasa.gov/sats/phys_par/',
  asteroids:'https://ssd-api.jpl.nasa.gov/sbdb.api',
};
const snapshotPath = new URL('./orrery-orbit-sources.json',import.meta.url);
const strip = s => s.replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ').trim();
const rows = html => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
  .map(m=>[...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c=>strip(c[1])));
const get = async url => {
  const response=await fetch(url); if(!response.ok)throw new Error(`${response.status}: ${url}`);
  return response.text();
};
let snapshot;
async function smallBodies(ids){
  const bodies=[];
  for(const id of ids){
    const url=`${urls.asteroids}?sstr=${id}&phys-par=1&full-prec=1`;
    const raw=JSON.parse(await get(url));
    if(raw.error||!raw.orbit||raw.orbit.equinox!=='J2000')throw new Error(`Invalid small body: ${id}`);
    const values=Object.fromEntries(raw.orbit.elements.map(e=>[e.name,Number(e.value)]));
    const physical=Object.fromEntries((raw.phys_par??[]).map(e=>[e.name,Number(e.value)]));
    bodies.push({id,name:raw.object.shortname.replace(/^\d+\s+/,''),epochJD:Number(raw.orbit.epoch),
      orbitId:raw.orbit.orbit_id,values,physical,url});
  }
  return bodies;
}
if(process.argv.includes('--cached')) snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8'));
else if(process.argv.includes('--extend-kuiper')){
  snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8'));
  snapshot.kuiper=await smallBodies(kuiperIds);
  snapshot.kuiperRetrieved=new Date().toISOString().slice(0,10);
  snapshot.kuiperSizes=kuiperSizes;
  await fs.writeFile(snapshotPath,JSON.stringify(snapshot,null,2)+'\n');
}
else {
  const elements=rows(await get(urls.moons));
  const sizes=rows(await get(urls.sizes));
  const moons=moonNames.map(name=>{
    const row=elements.find(r=>r[2]===name),size=sizes.find(r=>r[1]===name);
    if(!row||!size)throw new Error(`Missing satellite: ${name}`);
    return {name,row,diameterKm:parseFloat(size[4])*2};
  });
  const asteroids=await smallBodies(asteroidIds),kuiper=await smallBodies(kuiperIds);
  const retrieved=new Date().toISOString().slice(0,10);
  snapshot={retrieved,urls,moons,asteroids,kuiper,kuiperRetrieved:retrieved,kuiperSizes};
  await fs.writeFile(snapshotPath,JSON.stringify(snapshot,null,2)+'\n');
}
// North poles of the equatorial reference planes, IAU/ICRF J2000.
// Uranus uses its north orbital pole; its moons have small prograde inclinations
// in this frame. This is distinct from the planet's 97.8-degree spin obliquity.
const poles={uranus:[77.311,15.175],pluto:[132.993,-6.163]};
const colours={earth:'#c5c6c8',mars:'#b7a598',jupiter:'#c9bda5',saturn:'#dfd5bd',uranus:'#bdcbd0',neptune:'#a9bbce',pluto:'#b9aba3'};
const special={io:'#e5cf74',europa:'#d6c3a8',ganymede:'#b6aea3',callisto:'#a69f93',titan:'#dcb66d',enceladus:'#e5eef1',iapetus:'#b3a593',triton:'#d3bfc0',charon:'#a59c95'};
const moons=snapshot.moons.map(({name,row:r,diameterKm})=>{
  const parent=r[1].toLowerCase(),id=name.toLowerCase();
  const day=Number(r[6].slice(8));const epochJD=2440587.5+Date.parse(r[6].slice(0,8)+'01T00:00:00Z')/86400000+day-1;
  const displayDiameter=id==='moon'?.32:id==='ganymede'?.4:id==='charon'?.3:Math.max(.12,Math.min(.38,.12+Math.sqrt(diameterKm/5262.4)*.26));
  const pole=r[5]==='Laplace'?[Number(r[16]),Number(r[17])]:r[5]==='equatorial'?poles[parent]:undefined;
  if(r[5]!=='ecliptic'&&!pole)throw new Error(`Missing reference pole: ${name}`);
  return {id,name,colour:special[id]??colours[parent],diameterKm,displayDiameter:Number(displayDiameter.toFixed(3)),tilt:0,spinHours:Number(r[13])*24,
    satellite:{parent,distanceKm:Number(r[7]),periodDays:Number(r[13]),epochJD,eccentricity:Number(r[8]),argumentOfPeriapsis:Number(r[9]),meanAnomaly:Number(r[10]),inclination:Number(r[11]),ascendingNode:Number(r[12]),frame:r[5],...(pole?{poleRaDec:pole}:{} )}};
});
const asteroids=snapshot.asteroids.map(({id,name,epochJD,values:v,physical:p})=>({
  id:`asteroid-${id}`,name:name==='Europa'?'52 Europa':name,colour:id===1?'#c8c2b2':id===4?'#c9ad91':'#b8aa98',
  diameterKm:p.diameter,displayDiameter:Number((.12+Math.sqrt(p.diameter/939.4)*.16).toFixed(3)),
  tilt:0,spinHours:p.rot_per||24,kind:id===1?'dwarf-planet':'asteroid',region:'asteroids',
  elements:[v.a,v.e,v.i,v.ma+v.w+v.om,v.w+v.om,v.om],
  kepler:{epochJD,meanMotion:v.n},
}));
const kuiper=snapshot.kuiper.map(({id,name,epochJD,values:v,physical:p})=>{
  const diameter=p.diameter??snapshot.kuiperSizes[id]?.diameter;
  return {id:`kuiper-${id}`,name,colour:id===486958?'#cd8d72':id===136108?'#dae0e5':'#b8c2cf',
    diameterKm:diameter,displayDiameter:Number((.18+Math.sqrt(diameter/1430)*.3).toFixed(3)),
    tilt:0,spinHours:p.rot_per||24,...(!p.rot_per?{spinIllustrative:true}:{}),
    kind:[136108,136472].includes(id)?'dwarf-planet':'kuiper-object',region:'kuiper',
    elements:[v.a,v.e,v.i,v.ma+v.w+v.om,v.w+v.om,v.om],kepler:{epochJD,meanMotion:v.n}};
});
for(const world of [...moons,...asteroids,...kuiper]){
  if(!(world.diameterKm>0)||!(world.spinHours>0))throw new Error(`Missing physical data: ${world.name}`);
  if(world.satellite){
    const s=world.satellite;
    if(!(s.distanceKm>0)||!(s.periodDays>0)||!(s.eccentricity>=0&&s.eccentricity<1)||
      ![s.epochJD,s.meanAnomaly,s.argumentOfPeriapsis,s.inclination,s.ascendingNode,...s.poleRaDec??[]].every(Number.isFinite))throw new Error(`Invalid moon orbit: ${world.name}`);
  }else if(!world.elements.every(Number.isFinite)||!(world.elements[0]>0)||!(world.elements[1]>=0&&world.elements[1]<1)||!(world.kepler.meanMotion>0)||!Number.isFinite(world.kepler.epochJD))throw new Error(`Invalid small-body orbit: ${world.name}`);
}
const asRows=items=>'[\n'+items.map(w=>'  '+JSON.stringify(w)+',').join('\n')+'\n]';
const output=`// Generated by tools/prepare-orrery-orbits.mjs; sources and limits: docs/orrery-orbits.md.\nimport type { World } from './orrery-model.ts';\nexport const CATALOGUE_MOONS:World[] = ${asRows(moons)};\nexport const ASTEROIDS:World[] = ${asRows(asteroids)};\nexport const KUIPER_BODIES:World[] = ${asRows(kuiper)};\n`;
await fs.writeFile(new URL('../src/orrery-catalogue.ts',import.meta.url),output);
console.log(`Prepared ${moons.length} moons, ${asteroids.length} asteroids and ${kuiper.length} Kuiper belt bodies.`);
