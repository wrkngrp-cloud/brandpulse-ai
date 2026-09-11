/**
 * The palette, for the places a CSS variable cannot reach.
 *
 * Canvas, Mapbox paint properties, @react-pdf documents, email HTML and SVG
 * data URLs are all resolved outside the document's cascade, so `var(--flare)`
 * is meaningless in them. They read the value from here instead, which keeps
 * one name per colour even where the value has to travel as a literal.
 *
 * Values are brand/tokens.json v3.4. Do not add a colour to this file.
 * Anything rendered inside the document should use the CSS variable directly.
 */

export const TOKENS = {
  /* Ground. Carries about 75% of any surface. */
  ink: '#16120E',
  inkRaised: '#221D18',
  paper: '#FAF6EF',
  shell: '#F1ECE2',

  /* The ramp. A fire, read cold to hot. */
  char: '#5A1E0C',
  danfo: '#FFC12E',
  ember: '#FF9E1B',
  flare: '#FF3D14',
  flarePress: '#D62E0B',
  flareWash: '#FFE9E3',

  /* Polarity. There is no green in this system. */
  pos: '#16120E',
  neu: '#8C877E',
  neg: '#FF3D14',

  /* Text */
  tx: '#16120E',
  tx2: '#5B554D',
  tx3: '#8C877E',
  txInv: '#FAF6EF',
  txInv2: '#A9A299',
  txFlare: '#5A1E0C',

  /* Hairlines. Elevation is drawn, not shadowed. */
  line: 'rgba(22,18,14,.13)',
  lineStrong: 'rgba(22,18,14,.30)',
  lineInv: 'rgba(250,246,239,.15)',
} as const

/**
 * The crescendo, graded cold to hot. Use these as ordered steps along an arc,
 * a lane or a column — never as four separate stories in one frame.
 */
export const RAMP = [TOKENS.danfo, TOKENS.ember, TOKENS.flare] as const

/** Seven-step grade, tail to head. The mark's own sequence. */
export const RAMP_7 = [
  '#FFC12E', '#FFB528', '#FFAA21', '#FF9E1B', '#FF7E19', '#FF5D16', '#FF3D14',
] as const

/**
 * A chart's subject series carries heat; everything it is compared against is
 * neutral. That is what stops a multi-series chart turning into a rainbow.
 */
export const SERIES = {
  subject: TOKENS.flare,
  second: TOKENS.ember,
  third: TOKENS.danfo,
  fourth: TOKENS.char,
  compare: TOKENS.neu,
} as const

/** Heat for a value in 0..1, stepped along the ramp. Never interpolated. */
export function heat(t: number): string {
  const i = Math.round(Math.max(0, Math.min(1, t)) * (RAMP_7.length - 1))
  return RAMP_7[i]
}
