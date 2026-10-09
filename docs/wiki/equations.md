# Equations in the educational wiki

`src/wiki/reading.ts` renders LaTeX with bundled KaTeX and fonts. Both the hosted build and portable HTML work without a CDN. Visual HTML is paired with MathML for assistive technology. Prose is escaped; HTML commands in equations are not trusted.

Use `String.raw` for text containing inline maths:

```ts
String.raw`The effective exhaust velocity is \(v_{\mathrm{eff}}\).`
```

For a displayed equation, put an `EquationBlock` between strings in a reading’s `paragraphs` array, or use its final `equation` field:

```ts
{
  label: 'THE RELATIONSHIP',
  intro: 'A sentence introducing the idea.',
  steps: [{
    heading: 'A short, descriptive heading',
    expression: String.raw`a = \frac{F_{\mathrm{net}}}{m}`,
    explanation: [
      String.raw`Divide net force \(F_{\mathrm{net}}\) by mass \(m\) to find acceleration \(a\).`,
      'Explain the meaning, units and assumptions in ordinary language.',
    ],
  }],
}
```

An optional `details` object accepts `summary`, `intro` and another `steps` array for a fuller calculation. Wide equations scroll within their own keyboard-focusable area on small screens. Equation explanations, including optional details, are included in topic search.

Run `npm test` and `npm run build`. The equation tests render every reading with strict parsing, so invalid LaTeX fails before publication. Check new equations visually on a phone as well as a desktop.

## Rocket nozzle notation

The article uses `v_{\mathrm{eff}}` for thrust divided by mass flow, `v_e` for actual exit gas speed, and `A_{\mathrm{exit}}` for exit area. Its optional pressure-matching calculation uses chamber **total** pressure and the supersonic branch of the ideal area–Mach relation, consistent with `src/wiki/nozzle-model.ts`.

References checked on 9 October 2026: [NASA thrust equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/), [ideal rocket equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/), [nozzle design](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/nozzle-design/) and [isentropic flow relations](https://www.grc.nasa.gov/www/k-12/airplane/isentrop.html). Pressure matching applies to the ideal model in air; it does not give a finite optimum exit area in vacuum.
