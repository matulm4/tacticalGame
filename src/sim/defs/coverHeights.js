// Obstacle heights.
//
//   blocksMovement  every height stops walking
//   blocks          how it stops sight and bullets (interpreted by map/coverRules.js)
//                     'always'   high: nothing passes
//                     'crouched' low: blocks anyone crouched; standing agents see and shoot over it
//   soundDampening  each obstacle between a sound and a listener multiplies how far the
//                   sound carries by this (so a thick high wall muffles more than a low one)

export const COVER_HEIGHTS = Object.freeze({
  high: Object.freeze({ blocksMovement: true, blocks: 'always', soundDampening: 0.5 }),
  low: Object.freeze({ blocksMovement: true, blocks: 'crouched', soundDampening: 0.85 }),
});

export const DEFAULT_COVER_HEIGHT = 'high';
