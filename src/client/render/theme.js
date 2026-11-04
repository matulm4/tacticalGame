// All game colors and visual sizes live here. Nothing else in the codebase
// hardcodes a color, so restyling never touches logic. (Page chrome such as the
// HUD and debug panel is styled with CSS variables in styles/main.css.)
//
// Light theme: white page, dark obstacles.

export const theme = Object.freeze({
  colors: Object.freeze({
    background: '#ffffff',

    arena: '#fbfbfc',
    arenaBorder: '#9aa3ae',
    gridLine: 'rgba(20, 30, 45, 0.07)',

    // Low cover is light while you stand (you can see and shoot over it) and
    // turns as dark as high cover once you crouch (it now blocks you).
    obstacleHigh: '#1b1e23',
    obstacleLow: '#a4adb9',

    teams: Object.freeze({
      player: Object.freeze({ fill: '#2fbf71', crouched: '#1f8a4f' }),
      enemy: Object.freeze({ fill: '#e5484d', crouched: '#a8282d' }),
    }),
    agentOutline: 'rgba(20, 24, 30, 0.75)',
    aimLine: '#1b1e23',

    bullet: '#e08a00',
    muzzleFlash: '#ffb300',
    spark: '#e08a00',

    hitRing: '#d92d33',
    hpPip: '#e5484d',
    hpPipEmpty: 'rgba(20, 24, 30, 0.2)',

    crosshair: '#1b1e23',
    crosshairHalo: 'rgba(255, 255, 255, 0.95)',

    speechBubble: '#ffffff',
    speechBubbleEdge: 'rgba(20, 24, 30, 0.75)',
    speechText: '#1b1e23',

    planAccent: '#7c4dff', // plan overlay: paths and the current step
    planText: '#1b1e23',
    planLabel: 'rgba(255, 255, 255, 0.88)',

    coverHidden: 'rgba(31, 138, 79, 0.85)', // cover overlay: hides from the player
    coverExposed: 'rgba(20, 30, 45, 0.18)', // cover overlay: does not
    coverTaken: '#7c4dff', // cover overlay: ring round an enemy's chosen cover

    // Squad overlay: one color per squad, in turn.
    squads: Object.freeze(['#0a8f8c', '#c2570c', '#8a3fd1', '#2f6fd6']),
    squadText: '#1b1e23',
    squadLabel: 'rgba(255, 255, 255, 0.88)',

    // Debug visualizations (as specified in the design doc).
    soundWave: 'rgba(80, 150, 235, 0.16)', // soft blue
    soundWaveEdge: 'rgba(70, 140, 230, 0.55)',
    visionCone: 'rgba(250, 190, 0, 0.20)', // yellow
    visionConeEdge: 'rgba(214, 158, 0, 0.75)',
  }),

  editor: Object.freeze({
    selection: '#2f7df6',
    handleFill: '#ffffff',
    snapGrid: 'rgba(47, 125, 246, 0.14)',
    ghostAlpha: 0.55,
    handleSize: 9, // screen pixels
    selectionWidth: 2, // screen pixels
    minSnapGridPixels: 8, // hide the snap grid when its cells get smaller than this on screen
  }),

  // "world units" scale with the camera zoom; everything else is screen pixels.
  sizes: Object.freeze({
    cameraViewHeight: 760, // world units visible vertically in the close-up camera

    gridSpacing: 50, // world units
    arenaBorderWidth: 2,
    gridLineWidth: 1,

    agentOutlineWidth: 2,
    aimLineLength: 9, // world units, sticking out past the circle's edge
    aimLineWidth: 3.5, // world units

    speechFontSize: 13, // screen pixels
    speechOffset: 14, // screen pixels above the agent's circle (clears the HP pips)
    planFontSize: 11, // screen pixels
    planLabelOffset: 26, // world units below the agent's center

    hpPipRadius: 4, // world units
    hpPipOffset: 12, // world units above the agent's circle

    bulletLength: 16, // world units
    bulletWidth: 2.5,

    crosshairArm: 10,
    crosshairGap: 4,
    crosshairWidth: 2,
    crosshairHaloWidth: 5,
  }),
});
