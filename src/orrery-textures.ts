import * as THREE from 'three';
import { seeded, type World } from './orrery-model.ts';

import { WORLD_MAPS as MAPS } from './world-textures.ts';
import { SurfaceLod } from './surface-lod.ts';

type SurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
const loader=new THREE.TextureLoader();
export class PlanetSurface {
  readonly material:SurfaceMaterial;
  private surface:SurfaceLod<THREE.Texture>;
  constructor(readonly world:World,private anisotropy:number,maxTextureSize=8192){
    this.material=world.id==='sun'
      ?new THREE.MeshBasicMaterial({color:world.colour})
      :new THREE.MeshStandardMaterial({color:world.colour,roughness:world.id==='earth'?.68:.95,metalness:0});
    const maps=(MAPS[world.id]??[]).filter(map=>map.width<=maxTextureSize);
    this.surface=new SurfaceLod(maps.length,(level)=>new Promise((resolve,reject)=>{
      loader.load(maps[level].url,texture=>{
        this.configure(texture);resolve(texture);
      },undefined,reject);
    }),texture=>{
      // The overview becomes active before a larger texture is disposed.
      if(this.material.map===texture){
        this.material.map=null;this.material.color.set(world.colour);this.material.needsUpdate=true;
      }
      texture.dispose();
    });
  }
  private configure(texture:THREE.Texture){
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
    texture.anisotropy=this.anisotropy;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;
  }
  private use(texture:THREE.Texture){
    const needsCompile=!this.material.map;
    this.material.map=texture;this.material.color.set(0xffffff);
    if(needsCompile)this.material.needsUpdate=true;
  }
  /** Projected physical pixel diameter; off-screen objects use zero. */
  update(pixels:number,now:number){
    if(!MAPS[this.world.id])return;
    const texture=this.surface.update(pixels,now);
    if(texture&&this.material.map!==texture)this.use(texture);
  }
  releaseDetails(){this.surface.releaseDetails();this.update(0,performance.now());}
}

export function haloTexture():THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!;
  const grad=g.createRadialGradient(64,64,15,64,64,64);grad.addColorStop(0,'rgba(255,185,64,.35)');grad.addColorStop(.42,'rgba(255,146,24,.13)');grad.addColorStop(1,'rgba(255,100,10,0)');
  g.fillStyle=grad;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
export function ringTexture():THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=2048;c.height=4;const g=c.getContext('2d')!;const r=seeded(34);
  for(let x=0;x<c.width;x++){
    const u=x/c.width,cassini=u>.57&&u<.635,encke=u>.905&&u<.915;
    const fine=.035*Math.sin(u*1800)+.05*Math.sin(u*490)+r()*.08;
    const alpha=cassini||encke?.015:u<.19?.19+fine:u<.57?.7+fine:.42+fine;
    const shade=Math.round(185+24*Math.sin(u*28)+r()*12);
    g.fillStyle=`rgba(${shade+20},${shade+9},${shade-16},${alpha})`;g.fillRect(x,0,1,4);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;return t;
}
