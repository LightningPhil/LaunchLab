import { renderToString } from 'katex';
import type { EquationBlock, EquationStep, Reading } from './content.ts';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Bundled fonts/CSS are imported by wiki.ts, so this renderer also runs in tests.
 * MathML is kept alongside the visual layout for assistive technology. */
export function renderMath(expression: string, displayMode = false): string {
  return renderToString(expression, {
    displayMode, output: 'htmlAndMathml', throwOnError: true, strict: 'error', trust: false,
  });
}

/** Author inline LaTeX as String.raw`Text with \(math\).`; prose is never HTML. */
export function renderReadingText(text: string): string {
  let html = '', end = 0;
  for (const match of text.matchAll(/\\\(([\s\S]*?)\\\)/g)) {
    html += escape(text.slice(end, match.index)) + renderMath(match[1]);
    end = match.index! + match[0].length;
  }
  return html + escape(text.slice(end));
}

const paragraph = (text: string) => `<p>${renderReadingText(text)}</p>`;
function equationStep(step: EquationStep): string {
  return `<div class="atlas-equation-step">${step.heading ? `<h4>${escape(step.heading)}</h4>` : ''}<div class="atlas-math-display" tabindex="0" role="region" aria-label="Equation${step.heading ? `: ${escape(step.heading)}` : ''}">${renderMath(step.expression, true)}</div>${step.explanation.map(paragraph).join('')}</div>`;
}

export function renderEquationBlock(block: EquationBlock): string {
  return `<section class="atlas-equation" aria-label="${escape(block.label)}"><h3 class="atlas-equation-label">${escape(block.label)}</h3>${block.intro ? paragraph(block.intro) : ''}${block.steps.map(equationStep).join('')}${block.details ? `<details class="atlas-equation-details"><summary>${escape(block.details.summary)}</summary>${paragraph(block.details.intro)}${block.details.steps.map(equationStep).join('')}</details>` : ''}</section>`;
}

export function renderReading(reading: Reading): string {
  return `<section class="atlas-prose" aria-labelledby="atlas-reading-heading"><h2 id="atlas-reading-heading">${escape(reading.heading)}</h2>${reading.paragraphs.map(p => typeof p === 'string' ? paragraph(p) : renderEquationBlock(p)).join('')}${reading.equation ? renderEquationBlock(reading.equation) : ''}</section><aside class="atlas-takeaway"><span aria-hidden="true">✧</span><p class="atlas-kicker">ONE THING TO REMEMBER</p>${paragraph(reading.takeaway)}</aside>`;
}
