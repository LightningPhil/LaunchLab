import './welcome.css';
import { welcomeHidden, saveWelcomePreference } from './welcome-preference.ts';

let dialog: HTMLDialogElement | undefined;
export const isWelcomeOpen = () => !!dialog?.open;

export function installWelcome(onOpen: () => void) {
  if (dialog) return;
  const welcome = document.createElement('dialog');
  dialog = welcome;
  welcome.id = 'lab-welcome'; welcome.className = 'lab-welcome';
  welcome.setAttribute('aria-labelledby', 'welcome-title');
  welcome.setAttribute('aria-describedby', 'welcome-intro');
  welcome.innerHTML = `<div class="welcome-scroll"><div class="welcome-illustration" aria-hidden="true">
    <span class="welcome-stamp">LICENSED TO BE CURIOUS</span>
    <svg viewBox="0 0 680 165" focusable="false">
      <path d="M0 143Q170 119 340 143T680 136V165H0Z" fill="#d4dfbe"/>
      <path d="M123 121Q234 -32 397 94" fill="none" stroke="#a47b3b" stroke-width="2" stroke-dasharray="5 7"/>
      <circle cx="397" cy="94" r="9" fill="#3b534b"/><path d="m389 91 4-4" stroke="#7c9384" stroke-width="2"/>
      <g stroke="#3b534b" stroke-width="3"><path d="m91 132 12-15 34 6 11 13" fill="#bcad7e"/><path d="m94 111 18 17 37-41-13-12Z" fill="#69917d"/><path d="m137 75 12 12" stroke-width="6"/><circle cx="106" cy="135" r="15" fill="#bcad7e"/><circle cx="106" cy="135" r="5" fill="#fbf7ee"/></g>
      <g class="welcome-rocket" transform="translate(529 77) rotate(14)"><path d="m-8 30 8 22 8-22" fill="#d78c43"/><path d="m-11 18-12 16 12-3m22-13 12 16-12-3" fill="#69917d" stroke="#3b534b" stroke-width="2"/><path d="M-11 30V-6Q-9-22 0-31Q9-22 11-6V30Z" fill="#fffaf0" stroke="#3b534b" stroke-width="2.5"/><circle cy="-4" r="6" fill="#c1dce0" stroke="#3b534b" stroke-width="2"/><path d="M-11 21H11" stroke="#bcad7e" stroke-width="4"/></g>
      <g fill="#bcad7e"><path d="m467 26 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/><path d="m586 53 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"/></g>
      <text x="204" y="145" fill="#6a7860" font-size="12" font-family="Georgia,serif" font-style="italic">What goes up… makes a lovely experiment.</text>
    </svg></div>
    <div class="welcome-content"><p class="welcome-kicker">WELCOME TO LAUNCH LAB</p>
    <h1 id="welcome-title" tabindex="-1">Big curiosity.<br> Little launches<span>.</span></h1>
    <p class="welcome-intro" id="welcome-intro">A playful physics playground: fire a cannonball, launch a rocket, and discover <strong>how far or how high</strong> it goes on twelve different worlds.</p>
    <div class="welcome-orbit-note"><span aria-hidden="true">↗</span><p><strong>Small hops. Big shots. A whole trip around!</strong><br>See how far or high a cannonball flies, or try a rocket orbit. Open Rocket → Guidance for an Earth orbit example. Our worlds have gravity, but no air drag. No astronaut packing required.</p></div>
    <ol class="welcome-steps"><li><span aria-hidden="true">01</span><div><strong>Pick your playground</strong><p>Earth, the Moon, Ganymede… gravity changes the game.</p></div></li><li><span aria-hidden="true">02</span><div><strong>Launch. Watch. Tinker.</strong><p>Choose Cannon or Rocket. Change one setting and compare flights.</p></div></li><li><span aria-hidden="true">03</span><div><strong>Take a cosmic detour</strong><p>Explore the Solar System for stories and experiments; open the Orrery to watch worlds orbit.</p></div></li></ol>
    <p class="welcome-tip">Small screen? <strong>Setup</strong> opens your controls. The book button is your instruction manual.</p></div></div>
    <div class="welcome-actions"><div class="welcome-footer"><label><input type="checkbox" id="welcome-skip"> Don’t show this next time</label><button type="button" class="welcome-start">Let’s make some launches <span aria-hidden="true">↗</span></button></div>
    <p class="welcome-storage-note" role="status" hidden></p>
    <p class="welcome-return">Find this welcome again in Settings.</p></div>`;
  document.body.append(welcome);
  const checkbox = welcome.querySelector<HTMLInputElement>('#welcome-skip')!;
  const storageNote = welcome.querySelector<HTMLElement>('.welcome-storage-note')!;
  const settings = document.querySelector<HTMLDetailsElement>('.flight-settings')!;
  const reopen = document.createElement('button');
  reopen.type = 'button'; reopen.id = 'open-welcome'; reopen.textContent = 'Welcome to Launch Lab ↗';
  reopen.setAttribute('aria-haspopup', 'dialog'); reopen.setAttribute('aria-controls', welcome.id);
  settings.querySelector('.view-options')!.append(reopen);
  let returnFocus: HTMLElement | undefined;
  const readPreference = () => { try { return welcomeHidden(window.localStorage); } catch { return false; } };
  function savePreference() {
    let saved = false;
    try { saved = saveWelcomePreference(window.localStorage, checkbox.checked); } catch { /* storage getter may throw */ }
    storageNote.hidden = saved;
    storageNote.textContent = saved ? '' : 'This browser can’t save the checkbox, so the welcome may appear next time.';
  }
  function open(fromSettings = false) {
    if (welcome.open) return;
    returnFocus = fromSettings ? settings.querySelector<HTMLElement>('summary')! : undefined;
    settings.open = false; checkbox.checked = readPreference(); storageNote.hidden = true;
    welcome.showModal(); welcome.querySelector<HTMLElement>('#welcome-title')!.focus({preventScroll:true});
    welcome.querySelector('.welcome-scroll')!.scrollTop = 0; onOpen();
  }
  function close() {
    savePreference(); welcome.close();
    const launch = document.querySelector<HTMLElement>('#rocket-actions:not([hidden]) #btn-launch, #cannon-actions:not([hidden]) #btn-fire');
    (returnFocus ?? launch)?.focus({ preventScroll: true });
  }
  checkbox.addEventListener('change', savePreference);
  welcome.querySelector('.welcome-start')!.addEventListener('click', close);
  welcome.addEventListener('cancel', event => { event.preventDefault(); close(); });
  reopen.addEventListener('click', () => open(true));
  // Let links into a lesson open directly without stacking two modal readers.
  if (!readPreference() && !document.querySelector('dialog[open]')) open();
}
