import './world-view.css';
import { gravityAtAltitude, type WorldView } from './spherical-world.ts';
import type { Environment } from './environment.ts';

export class WorldViewControls {
  private information: HTMLOutputElement;
  constructor(parent: HTMLElement, onView: (view: WorldView) => void, onField: (show: boolean) => void) {
    const bar = document.createElement('div');
    bar.className = 'world-view-controls';
    bar.innerHTML = `<label class="world-view-choice" for="world-view">View <select id="world-view" aria-label="World view">
      <option value="flight">Follow flight</option><option value="horizon">Horizon</option><option value="world">Whole world</option>
      </select></label><label class="world-field-choice" title="Show inward gravity and how its strength falls with distance"><input type="checkbox" id="world-gravity-field"> Gravity field</label>
      <output class="world-scale-info" aria-live="off" aria-label="World radius and gravity at the current altitude"></output>`;
    parent.append(bar);
    this.information = bar.querySelector('output')!;
    bar.querySelector('select')!.addEventListener('change', event => onView((event.target as HTMLSelectElement).value as WorldView));
    bar.querySelector('input')!.addEventListener('change', event => onField((event.target as HTMLInputElement).checked));
  }
  update(environment: Environment, altitude: number) {
    const name = environment.name[0].toUpperCase() + environment.name.slice(1);
    const gravity = gravityAtAltitude(environment.radius, environment.gravity, altitude);
    const text = `${name} · radius ${(environment.radius / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} km · g here ${gravity.toFixed(2)} m/s²`;
    if (this.information.textContent !== text) this.information.textContent = text;
  }
}
