import test from 'node:test';
import assert from 'node:assert/strict';
import { displayProfile } from '../src/display-layout.ts';

const profile=(width,height,pixelRatio=1,viewportScale=1)=>displayProfile({width,height,pixelRatio,viewportScale,screenWidth:width,screenHeight:height});

test('scaled tablet and short landscape views keep a full field with compact controls',()=>{
  for(const [width,height] of [[1280/1.5,800/1.5],[1536/1.5,864/1.5],[1920/1.5,1080/1.5-110],[1024,768],[768,1024],[390,844],[1366,600]]){
    assert.equal(profile(width,height,1.5).compact,true,`${width} × ${height}`);
  }
  assert.equal(profile(1440,900,1.5).compact,false,'scaling alone does not force a roomy desktop into tablet mode');
  assert.equal(profile(1280,720).compact,false);
});

test('retina density and pinch zoom preserve readable CSS sizes',()=>{
  assert.equal(profile(1440,900,2).compact,false);
  assert.equal(profile(1440,900,3).pixelRatio,3);
  assert.equal(profile(1440,900,.8).compact,false);
  assert.equal(profile(1440,900,2,2).viewportScale,2);
  assert.equal(profile(1440,900,2,2).width,1440,'pinching is a viewing aid, not permission to undo the user’s zoom');
});
