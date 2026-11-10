// Dice Grid — p5.js sketch for the Generative Art project
// PHYSICAL OVERLAY VERSION (10 Nov 2026)
//
// The grid is shown on a screen and stays still once rolled. A real disc of
// straight black lines, printed on clear film, turns over the screen. The
// disc can't be changed by code, so everything generative lives in the grid,
// and the grid's band spacing is locked to the disc's printed line pitch
// in real millimetres.
//
// Each cell of an N×N grid is driven by dice (1–6):
//   • FACE die: number of bands, stacked from one corner.
//       Weighted by row: 75% chance of the row's own number.
//   • TURN die: which corner (1/5 bottom-left, 2/6 top-left,
//       3 top-right, 4 bottom-right).
//   • INVERT die: 1–3 → dark bands on light, 4–6 → light bands on dark.
//   • TILT die (optional): tilts the cell's bands by (die − 1) × TILT_STEP°.
//       As the disc turns, each cell lines up with it at a slightly different
//       angle, so the cells flash in the order of their tilt dice.
//
// Press SPACE or R (or the Roll button) to roll every die again.

// ---- physical setup -------------------------------------------------------
// Centre-to-centre spacing of the printed disc lines, in mm. The tile bands
// use exactly this spacing, so a tile's side is 6 × pitch / √2 (≈ 21.2 mm at 5 mm).
// If you change this, reprint the disc at the same pitch.
const BAND_PITCH_MM = 5;
const DISC_LINE_RATIO = 0.5;  // printed line width ÷ pitch (fixed on the film)

// Screen pixels (CSS px) per real millimetre. Set once with the calibration
// card on the page; saved in this browser. 96/25.4 is the CSS nominal value,
// which most screens don't actually match.
const NOMINAL_PX_PER_MM = 96 / 25.4;
let pxPerMm = loadCalibration();

function loadCalibration() {
  try {
    const v = parseFloat(localStorage.getItem('diceGrid.pxPerMm'));
    if (v > 1 && v < 20) return v;
  } catch (e) {}
  return NOMINAL_PX_PER_MM;
}
function setCalibration(v) {
  pxPerMm = v;
  try { localStorage.setItem('diceGrid.pxPerMm', String(v)); } catch (e) {}
  sizeCanvas();
}
function cellPx() { return (6 * BAND_PITCH_MM / Math.SQRT2) * pxPerMm; }
function cellMm() { return 6 * BAND_PITCH_MM / Math.SQRT2; }
function gridMm() { return N * cellMm(); }
// Smallest disc that covers the whole grid when pivoted on the grid's centre,
// plus a margin for handling
function discDiameterMm(marginMm = 10) { return gridMm() * Math.SQRT2 + 2 * marginMm; }

// ---- state ----------------------------------------------------------------
let N = 6;                 // grid size, starts at 6×6
let dice = [];             // face die:   dice[row][col]    = 1..6
let turns = [];            // turn die:   turns[row][col]   = 1..6
let inverts = [];          // invert die: inverts[row][col] = 1..6
let tilts = [];            // tilt die:   tilts[row][col]   = 1..6
let tiltOn = false;        // use the tilt die
const TILT_STEP = 1.5;     // degrees per pip above 1 (die 6 → 7.5°)
let showDice = false;      // overlay the raw dice faces
let pivotMark = false;     // small crosshair at the grid centre, for lining up the disc
let rollCount = 0;

// PREVIEW ONLY: an on-screen stand-in for the printed disc, for trying
// things out without the real one. Off by default; it is not the artwork.
let previewOn = false;
let previewSpin = 4;       // degrees per second
let previewAngle = 0.12;

const PAPER = '#ECEEF1';
const INK = '#1B1B1E';

let gridLayer;

// ---- setup / sizing -------------------------------------------------------
function setup() {
  const c = createCanvas(10, 10);
  c.parent('stage');
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) previewSpin = 0;
  drawFaceKey();
  rollDice();
}

// The canvas is drawn at true size: N cells of cellPx() each. It is never
// scaled to fit the window, or the bands would stop matching the disc.
function sizeCanvas() {
  const px = Math.round(N * cellPx());
  if (px !== width || px !== height) resizeCanvas(px, px);
  buildGrid();
  applyLoop();
  if (typeof onResized === 'function') onResized();
}

function applyLoop() {
  if (previewOn && previewSpin > 0) loop();
  else { noLoop(); redraw(); }
}

function setPreview(on) { previewOn = on; applyLoop(); }
function setPreviewSpin(degPerSec) { previewSpin = degPerSec; applyLoop(); }
function setShowDice(on) { showDice = on; redraw(); }
function setPivotMark(on) { pivotMark = on; redraw(); }
function setTilt(on) { tiltOn = on; buildGrid(); redraw(); }

// ---- dice -----------------------------------------------------------------
function rollDice() {
  dice = []; turns = []; inverts = []; tilts = [];
  for (let r = 0; r < N; r++) {
    const f = [], t = [], k = [], l = [];
    for (let c = 0; c < N; c++) {
      f.push(rollFace(r));
      t.push(floor(random(1, 7)));
      k.push(floor(random(1, 7)));
      l.push(floor(random(1, 7)));
    }
    dice.push(f); turns.push(t); inverts.push(k); tilts.push(l);
  }
  rollCount++;
  sizeCanvas();
  if (typeof onRolled === 'function') onRolled(dice, turns, inverts, tilts, rollCount);
}

// Each row has a home face: row 1 → 1 … row 6 → 6, then it wraps.
// 75% chance of the home face, otherwise one of the other five (5% each).
const HOME_FACE_CHANCE = 0.75;
function rowFace(r) { return (r % 6) + 1; }
function rollFace(r) {
  const home = rowFace(r);
  if (random() < HOME_FACE_CHANCE) return home;
  return random([1, 2, 3, 4, 5, 6].filter(f => f !== home));
}

function setGridSize(n) { N = n; rollDice(); }

// ---- drawing --------------------------------------------------------------
function buildGrid() {
  if (!gridLayer || gridLayer.width !== width || gridLayer.height !== height) {
    if (gridLayer) gridLayer.remove();
    gridLayer = createGraphics(width, height);
  }
  gridLayer.background(PAPER);
  const cell = width / N;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      drawTile(dice[r][c], turns[r][c], inverts[r][c], r, c, cell, gridLayer,
               tiltOn ? (tilts[r][c] - 1) * TILT_STEP : 0);
}

function draw() {
  if (!gridLayer) return;
  image(gridLayer, 0, 0, width, height);

  if (previewOn) {
    drawPreviewDisc(previewAngle);
    previewAngle += radians(previewSpin) * (deltaTime / 1000);
  }

  if (showDice) {
    const cell = width / N;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        drawDie(dice[r][c], c * cell, r * cell, cell, 'face');
        drawDie(inverts[r][c], c * cell, r * cell, cell, 'invert');
        drawDie(turns[r][c], c * cell, r * cell, cell, 'turn');
        if (tiltOn) drawDie(tilts[r][c], c * cell, r * cell, cell, 'tilt');
      }
  }

  if (pivotMark) {
    const a = cellPx() * 0.18;
    push();
    stroke('#E4572E'); strokeWeight(1.5); noFill();
    line(width / 2 - a, height / 2, width / 2 + a, height / 2);
    line(width / 2, height / 2 - a, width / 2, height / 2 + a);
    circle(width / 2, height / 2, a);
    pop();
  }
}

// Stand-in for the printed disc: straight black lines at the same pitch and
// line width as the film, pivoting on the grid centre.
function drawPreviewDisc(angle) {
  const P = BAND_PITCH_MM * pxPerMm;
  const W = P * DISC_LINE_RATIO;
  const R = Math.hypot(width, height) / 2;
  push();
  translate(width / 2, height / 2);
  rotate(angle);
  noStroke();
  fill(0);
  const n = ceil(R / P) + 1;
  for (let k = -n; k <= n; k++) rect(-R, k * P - W / 2, 2 * R, W);
  pop();
}

// Band geometry for a tile of side s: the diagonal (s·√2) holds six equal
// slots, so the spacing equals BAND_PITCH_MM on screen once calibrated.
function bandSpacing(s) { return (s * Math.SQRT2) / 6; }
function bandWidth(s) { return bandSpacing(s) * bandRatio; }

// Share of each slot taken up by a band. 0.5 matches the printed disc line
// ratio, which gives the deepest moiré (full black at the right angle).
let bandRatio = 0.5;
function setBandRatio(f) { bandRatio = f; buildGrid(); drawFaceKey(true); redraw(); }

// g: optional p5.Graphics to draw into; tiltDeg: extra rotation for the tilt die
function drawTile(v, t, k, r, c, s, g, tiltDeg = 0) {
  const p = g || window;
  const ctx = g ? g.drawingContext : drawingContext;
  const h = s / 2;
  const inverted = k >= 4;
  const ground = inverted ? INK : PAPER;
  const band = inverted ? PAPER : INK;

  p.push();
  p.translate(c * s, r * s);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, s, s);
  ctx.clip();

  p.noStroke();
  p.fill(ground);
  p.rect(0, 0, s, s);

  p.translate(h, h);
  // turn die: 1 or 5 → bottom-left, 2 or 6 → top-left, 3 → top-right, 4 → bottom-right
  p.rotate(((t - 1) % 4) * HALF_PI);
  p.rotate(QUARTER_PI);                 // bands on the diagonal
  if (tiltDeg) p.rotate(radians(tiltDeg));

  // Bands stack out from the start corner, one per pip on the face die.
  // Six bands + six gaps fill the diagonal exactly, so (without tilt) every
  // band edge meets the neighbouring tile's edges however it's turned.
  const D = s * Math.SQRT1_2;
  const W = bandWidth(s);
  const P = bandSpacing(s);
  p.fill(band);
  for (let i = 0; i < v; i++) p.rect(-s, D - i * P - W, s * 2, W);

  ctx.restore();
  p.pop();
}

// ---- face key -------------------------------------------------------------
const keyLayers = {};
function drawFaceKey(refresh) {
  for (let v = 1; v <= 6; v++) {
    const slot = document.getElementById('face-' + v);
    if (!slot) continue;
    const size = 96;
    if (refresh && keyLayers[v]) { keyLayers[v].clear(); drawTile(v, 1, 1, 0, 0, size, keyLayers[v]); continue; }
    const pg = createGraphics(size, size);
    keyLayers[v] = pg;
    drawTile(v, 1, 1, 0, 0, size, pg);
    pg.elt.style.display = 'block';
    pg.elt.style.width = '100%';
    pg.elt.style.height = 'auto';
    slot.appendChild(pg.elt);
  }
}

// ---- dice overlay ---------------------------------------------------------
// white top-left = face · grey top-right = invert · dark bottom-right = turn
// · outlined bottom-left = tilt
const PIPS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
const DIE_STYLE = {
  face:   { body: '#FFFFFF', pip: '#1B1B1E', edge: '#1B1B1E' },
  invert: { body: '#8A8F99', pip: '#FFFFFF', edge: '#FFFFFF' },
  turn:   { body: '#1B1B1E', pip: '#FFFFFF', edge: '#FFFFFF' },
  tilt:   { body: '#E4572E', pip: '#FFFFFF', edge: '#FFFFFF' },
};
function drawDie(v, x, y, s, kind) {
  const d = s * 0.3, m = s * 0.05, st = DIE_STYLE[kind];
  push();
  const right = kind === 'turn' || kind === 'invert';
  const bottom = kind === 'turn' || kind === 'tilt';
  translate(right ? x + s - m - d / 2 : x + m + d / 2, bottom ? y + s - m - d / 2 : y + m + d / 2);
  stroke(st.edge);
  strokeWeight(max(1, s * 0.012));
  fill(st.body);
  rect(-d / 2, -d / 2, d, d, d * 0.2);
  noStroke();
  fill(st.pip);
  for (const [px, py] of PIPS[v]) circle(px * d * 0.28, py * d * 0.28, d * 0.18);
  pop();
}

function keyPressed() {
  if (key === ' ' || key === 'r' || key === 'R') { rollDice(); return false; }
}
