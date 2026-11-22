import test from 'node:test';
import assert from 'node:assert/strict';
import { ExhibitAudio } from '../src/wiki/exhibit-audio.ts';
class Parameter {value=0;setValueAtTime(v: number){this.value=v;}setTargetAtTime(v: number){this.value=v;}linearRampToValueAtTime(v: number){this.value=v;}}
class MockAudioNode {
  gain=new Parameter();frequency=new Parameter();Q=new Parameter();
  connections: MockAudioNode[]=[];started=false;stopped=false;loop=false;type='';
  connect(n: MockAudioNode){this.connections.push(n);return n;}
  disconnect(){this.connections=[];}start(){this.started=true;}stop(){this.stopped=true;}
}
class Context {
  static last: Context;
  state='suspended';sampleRate=8000;currentTime=0;destination=new MockAudioNode();nodes: MockAudioNode[]=[];
  constructor(){Context.last=this;}
  node(){const n=new MockAudioNode();this.nodes.push(n);return n;}
  createGain(){return this.node();}createOscillator(){return this.node();}createBufferSource(){return this.node();}createBiquadFilter(){return this.node();}
  createBuffer(_channels: number,length: number){const data=new Float32Array(length);return {getChannelData:()=>data};}
  async resume(){this.state='running';}async close(){this.state='closed';}
}
test('quiet audio unlock stays silent until activity, then mutes/disposes engine and fuse',async()=>{
  const g = globalThis as Record<string, unknown>, old=g.window;
  g.window={AudioContext:Context};
  try{
    const messages: string[]=[],audio=new ExhibitAudio(m=>messages.push(m));await audio.enable();const c=Context.last;
    assert.equal(c.state,'running');assert.match(messages.at(-1)!,/Quiet sound effects/);assert.equal(c.nodes.filter(n=>n.started).length,2);
    const master=c.nodes[0],engine=c.nodes[1],fuse=c.nodes.find(n=>n.type==='bandpass')!.connections[0];
    assert.equal(engine.gain.value,0);assert.equal(fuse.gain.value,0);
    audio.setEngine(true,1);assert.ok(engine.gain.value*master.gain.value<=.1);assert.ok(engine.gain.value>0);
    audio.setEngine(false);assert.equal(engine.gain.value,0);
    audio.setFuse(true,.4);assert.ok(fuse.gain.value>0&&fuse.gain.value*master.gain.value<.06);
    audio.setFuse(false);assert.equal(fuse.gain.value,0);
    audio.effect('boom');assert.equal(c.nodes.filter(n=>n.started).length,3);
    audio.setFuse(true,.6);audio.setEngine(true,1);
    audio.mute();audio.setEngine(true,1);audio.setFuse(true,1);assert.equal(engine.gain.value,0);assert.equal(fuse.gain.value,0);assert.equal(master.gain.value,0);
    const count=c.nodes.length;audio.effect('whoosh');assert.equal(c.nodes.length,count);
    audio.dispose();assert.equal(c.state,'closed');assert.ok(c.nodes.filter(n=>n.started&&n.loop).every(n=>n.stopped));
  }finally{g.window=old;}
});
test('audio reports resume rejection and cancels a pending unlock if muted',async()=>{
  const g = globalThis as Record<string, unknown>, old=g.window;
  try{
    class Blocked extends Context {override async resume(): Promise<void>{throw new Error('blocked');}}
    g.window={AudioContext:Blocked};const messages: string[]=[],a=new ExhibitAudio(m=>messages.push(m));await a.enable();assert.match(messages.at(-1)!,/could not start/);assert.equal(Context.last.nodes.filter(n=>n.started).length,2);a.dispose();
    let resolve!: ()=>void;
    class Pending extends Context {override resume(){return new Promise<void>(r=>{resolve=()=>{this.state='running';r();};});}}
    g.window={webkitAudioContext:Pending};const b=new ExhibitAudio(m=>messages.push(m)),promise=b.enable();b.mute();resolve();await promise;assert.equal(Context.last.nodes.filter(n=>n.started).length,2);assert.equal(messages.at(-1),'Sound off.');b.dispose();
  }finally{g.window=old;}
});
