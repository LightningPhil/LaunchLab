import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTICLES, getArticle, searchArticles } from '../src/wiki/content.ts';
import { renderMath, renderReading, renderReadingText } from '../src/wiki/reading.ts';

test('every authored wiki equation renders valid LaTeX with accessible MathML', () => {
  let equations = 0;
  for (const article of ARTICLES) for (const reading of article.levels) {
    const html = renderReading(reading); // strict parsing fails on invalid or unsupported LaTeX
    assert.doesNotMatch(html, /katex-error|\[object Object\]/, article.id);
    assert.doesNotMatch(html, /\\\(|\\\)/, `${article.id}: no visible inline delimiters`);
    const displays = (html.match(/class="katex-display"/g) || []).length;
    equations += displays;
    if (displays) {
      assert.match(html, /<math[^>]+display="block"/);
      assert.match(html, /class="katex-html" aria-hidden="true"/);
    }
  }
  assert.ok(equations >= 11, 'covers solar, cannon, rocket and optional nozzle equations');
});

test('equations can sit between paragraphs; eff and exit are complete subscripts', () => {
  const html = renderReading(getArticle('rockets').levels[2]);
  assert.ok(html.indexOf('THE IDEAL ROCKET EQUATION') < html.indexOf('invented classroom quantities'));
  assert.match(html, /<msub><mi>v<\/mi><mrow><mi mathvariant="normal">e<\/mi><mi mathvariant="normal">f<\/mi><mi mathvariant="normal">f<\/mi><\/mrow><\/msub>/);
  assert.match(html, /<details class="atlas-equation-details">/);
  assert.doesNotMatch(html, /vₑff|Aₑ/);
  assert.match(html, /A_\{\\mathrm\{exit\}\}/);
});

test('prose is escaped, supported math is rendered, and trusted HTML commands stay disabled', () => {
  const html = renderReadingText(String.raw`Compare <tag> & "text" with \(v_{\mathrm{eff}}\).`);
  assert.match(html, /&lt;tag&gt; &amp; &quot;text&quot;/);
  assert.match(html, /<msub>/);
  assert.throws(() => renderMath(String.raw`\notARealCommand{x}`));
  assert.doesNotMatch(renderMath(String.raw`\href{https://example.com}{x}`), /<a\b|href=/);
});

test('topic search includes explanations inside equation blocks and their optional details', () => {
  assert.ok(searchArticles('natural logarithm').some(a => a.id === 'rockets'));
  assert.ok(searchArticles('stagnation').some(a => a.id === 'rockets'));
});
