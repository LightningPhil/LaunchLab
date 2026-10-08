import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { TouchPan, panOrthographic } from '../src/orrery-navigation.ts';

const touch=(pointerId,clientX,clientY=200)=>({pointerId,clientX,clientY});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} should equal ${expected}`);
const project=(point,camera,width,height)=>{
  camera.updateMatrixWorld();
  const p=point.clone().project(camera);
  return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};
};

test('screen panning follows the fingers at every zoom, aspect ratio and camera angle',()=>{
  for(const [width,height] of [[390,500],[1024,768],[1440,600]])for(const zoom of [.35,1,20,45])for(const view of ['home','top','rolled']){
    const camera=new THREE.OrthographicCamera(-40*width/height,40*width/height,40,-40,.01,2000);
    const target=new THREE.Vector3(3,-2,5);
    camera.position.set(0,100,90).add(target);
    if(view==='top'){camera.position.copy(target).add(new THREE.Vector3(0,150,0));camera.up.set(0,0,-1);}
    if(view==='rolled')camera.up.set(.8,.6,0);
    camera.lookAt(target);camera.zoom=zoom;camera.updateProjectionMatrix();
    const point=new THREE.Vector3(6,2,8),before=project(point,camera,width,height);
    const offset=camera.position.clone().sub(target),quaternion=camera.quaternion.clone();
    panOrthographic(camera,target,width,height,37,-24);
    const after=project(point,camera,width,height);
    near(after.x-before.x,37);near(after.y-before.y,-24);
    near(camera.position.clone().sub(target).distanceTo(offset),0);
    assert.deepEqual(camera.quaternion.toArray(),quaternion.toArray());
    assert.equal(camera.zoom,zoom);
  }
});

test('two fingers translate together; symmetric pinching has no accumulated pan',()=>{
  const gesture=new TouchPan();
  gesture.start(touch(1,100));gesture.start(touch(2,200));
  gesture.move(touch(1,140,220));gesture.move(touch(2,240,220));
  assert.deepEqual(gesture.consume(),{x:40,y:20});
  gesture.move(touch(1,120,220));gesture.move(touch(2,260,220));
  assert.deepEqual(gesture.consume(),{x:0,y:0});
  assert.deepEqual(gesture.consume(),{x:0,y:0},'a pan is applied only once');
});

test('adding, lifting, cancelling and replacing contacts do not jump or select a planet',()=>{
  const gesture=new TouchPan();
  gesture.start(touch(1,100));gesture.move(touch(1,150));
  assert.deepEqual(gesture.consume(),{x:0,y:0});
  gesture.start(touch(2,300));
  assert.equal(gesture.suppressTap,true);
  assert.deepEqual(gesture.consume(),{x:0,y:0},'adding a distant finger does not pan');
  gesture.move(touch(1,170));gesture.move(touch(2,320));
  gesture.end(touch(2,320));
  assert.deepEqual(gesture.consume(),{x:20,y:0},'lifting before the frame does not lose the last pan');
  gesture.move(touch(1,190));
  assert.deepEqual(gesture.consume(),{x:0,y:0},'one remaining finger does not pan');
  assert.equal(gesture.suppressTap,true);
  gesture.start(touch(3,500));
  assert.deepEqual(gesture.consume(),{x:0,y:0});
  gesture.move(touch(1,210));gesture.move(touch(3,520));
  assert.deepEqual(gesture.consume(),{x:20,y:0});
  gesture.end(touch(1,210));gesture.end(touch(3,520));
  assert.equal(gesture.suppressTap,true,'the final release still belongs to a gesture');
  gesture.start(touch(4,200));
  assert.equal(gesture.suppressTap,false,'a fresh single-finger tap works again');
});

test('extra contacts and interrupted gestures cannot leave stale panning',()=>{
  const gesture=new TouchPan();
  gesture.start(touch(1,100));gesture.start(touch(2,200));gesture.start(touch(3,300));
  gesture.move(touch(1,150));gesture.move(touch(3,350));
  assert.deepEqual(gesture.consume(),{x:0,y:0});
  gesture.end(touch(3,350));gesture.move(touch(1,170));gesture.move(touch(2,220));
  assert.deepEqual(gesture.consume(),{x:20,y:0});
  gesture.move(touch(1,190));gesture.reset();gesture.move(touch(2,240));
  assert.deepEqual(gesture.consume(),{x:0,y:0});
  assert.equal(gesture.suppressTap,true);
});

// Exercise the installed Three.js controls too: our observer must coexist with
// their real pointer handlers, rotation and clamped pinch zoom.
function navigation(t){
  const previousWindow=globalThis.window;
  const window=Object.assign(new EventTarget(),{pageXOffset:0,pageYOffset:0});
  globalThis.window=window;
  const document=Object.assign(new EventTarget(),{documentElement:{clientLeft:0,clientTop:0}});
  const canvas=Object.assign(new EventTarget(),{
    ownerDocument:document,style:{},clientWidth:1000,clientHeight:600,
    getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600}),
    setPointerCapture(){},releasePointerCapture(){},
  });
  const camera=new THREE.OrthographicCamera(-100,100,60,-60,.01,2000);
  camera.position.set(0,100,90);
  const controls=new TrackballControls(camera,canvas);
  controls.noPan=true;controls.staticMoving=true;controls.minZoom=.35;controls.maxZoom=45;
  const gesture=new TouchPan();
  canvas.addEventListener('pointerdown',e=>gesture.start(e));
  document.addEventListener('pointermove',e=>gesture.move(e));
  document.addEventListener('pointerup',e=>gesture.end(e));
  canvas.addEventListener('pointercancel',e=>gesture.end(e));
  t.after(()=>{controls.dispose();if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;});
  return {
    camera,controls,gesture,
    send(type,id,x,y=200){
      const event=Object.assign(new Event(type),touch(id,x,y),{pageX:x,pageY:y,pointerType:'touch',button:0});
      (type==='pointermove'||type==='pointerup'?document:canvas).dispatchEvent(event);
    },
    frame(){controls.update();const {x,y}=gesture.consume();panOrthographic(camera,controls.target,1000,600,x,y);},
  };
}

test('real Trackball controls preserve zoom and orientation during a two-finger pan',t=>{
  const n=navigation(t),point=new THREE.Vector3(0,0,0);
  const before=project(point,n.camera,1000,600),orientation=n.camera.quaternion.clone();
  n.send('pointerdown',1,100);n.send('pointerdown',2,200);
  n.send('pointermove',1,140,230);n.send('pointermove',2,240,230);n.frame();
  const after=project(point,n.camera,1000,600);
  near(after.x-before.x,40);near(after.y-before.y,30);
  near(n.camera.zoom,1);assert.ok(n.camera.quaternion.angleTo(orientation)<1e-7);
  n.send('pointerup',1,140,230);n.send('pointerup',2,240,230);n.frame();
  assert.equal(n.gesture.suppressTap,true);
});

test('real pinch zoom works alone and together with translation, retaining zoom limits',t=>{
  const n=navigation(t);
  n.send('pointerdown',1,100);n.send('pointerdown',2,200);
  n.send('pointermove',1,80);n.send('pointermove',2,220);n.frame();
  near(n.camera.zoom,1.4);near(n.controls.target.length(),0);
  n.send('pointermove',1,90,230);n.send('pointermove',2,250,230);n.frame();
  near(n.camera.zoom,1.6);
  const screen=project(new THREE.Vector3(),n.camera,1000,600);
  near(screen.x,520);near(screen.y,330);
  n.send('pointermove',1,-10000);n.send('pointermove',2,10000);n.frame();
  assert.equal(n.camera.zoom,45);
  n.send('pointermove',1,150);n.send('pointermove',2,150.01);n.frame();
  assert.equal(n.camera.zoom,.35);
});

test('a single finger still rotates without panning',t=>{
  const n=navigation(t),before=n.camera.quaternion.clone();
  n.send('pointerdown',1,100);n.send('pointermove',1,180,240);n.frame();
  assert.ok(n.camera.quaternion.angleTo(before)>.01);
  near(n.controls.target.length(),0);near(n.camera.zoom,1);
  assert.equal(n.gesture.suppressTap,false);
});
