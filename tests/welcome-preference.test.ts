import test from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME_STORAGE_KEY, welcomeHidden, saveWelcomePreference } from '../src/welcome-preference.ts';

test('welcome suppression survives a new session and can be reversed from Settings',()=>{
  const values=new Map<string,string>(),storage:Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  assert.equal(welcomeHidden(storage),false);
  assert.equal(saveWelcomePreference(storage,true),true);
  assert.equal(values.get(WELCOME_STORAGE_KEY),'yes');
  assert.equal(welcomeHidden({...storage}),true);
  assert.equal(saveWelcomePreference(storage,false),true);
  assert.equal(welcomeHidden(storage),false);
});

test('unavailable storage leaves the lab usable and does not silently claim to remember',()=>{
  const blocked={getItem(){throw new Error('denied');},setItem(){throw new Error('quota');},removeItem(){throw new Error('denied');}};
  assert.equal(welcomeHidden(blocked),false);
  assert.equal(saveWelcomePreference(blocked,true),false);
  assert.equal(saveWelcomePreference(blocked,false),false);
});
