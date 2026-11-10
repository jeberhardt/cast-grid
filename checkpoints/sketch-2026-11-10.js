// Dice Grid — p5.js sample for the Generative Art project
// Each cell of an N×N grid is driven by three dice (1–6).
//   • The FACE die is the number of bands, stacked from one corner.
//       It's weighted by row: 75% chance of the row's own number.
//   • The TURN die picks that corner (1/5 bottom-left, 2/6 top-left,
//       3 top-right, 4 bottom-right).
//   • The INVERT die swaps the colours: 1–3 → dark bands on light,
//       4–6 → light bands on dark.
// A large disc of diagonal stripes spins behind the grid. Its stripes
// match the face bands in width and spacing. The stripes are solid black and
// the gaps are clear, so the two stripe sets interfere and make a moiré pattern.
// Press SPACE or R (or the Roll button) to roll every die again.

let N = 6;                 // grid size, starts at 6×6
let dice = [];             // face die:  dice[row][col]  = 1..6
let turns = [];            // turn die:  turns[row][col] = 1..6
let inverts = [];          // invert die: inverts[row][col] = 1..6
let showDice = false;      // overlay the raw dice faces
let rollCount = 0;

let gridLayer;             // the grid is drawn once per roll into this buffer
let discOn = true;         // show the spinning disc
let discPattern = 'widening'; // 'stripes', 'widening' or 'spiral'
let discBehind = true;     // disc behind the grid (true) or in front of it (false)
let disc2On = false;       // a second disc, same pattern, spinning the opposite way
let spin = 4;              // disc speed in degrees per second
let discAngle = 0.12;       // start a little off horizontal
const DISC2_OFFSET = 0.15;  // radians (~9°) the second disc starts away from the first,
                           // so the two never sit exactly on top of each other at rest
const WIDEN_RANGE = 3;     // widening stripes: spacing goes from 1/3× the tile spacing
                           // on one side of the disc to 3× on the other (1× through the centre)
const DISC_OFFSET = 0;     // how far the disc centre is shifted right and down, as a fraction of the canvas
                           // (0 = the middle; the 9 Nov checkpoint used 0.25)

const PAPER = '#ECEEF1';
const INK = '#1B1B1E';     // every motif is drawn in this single ink

// Debug colours: paint the grid red (ink) and green (paper) so it's easy to
// tell apart from the black-and-white disc.
let debugColours = false;
const DEBUG_INK = '#D7263D';
const DEBUG_PAPER = '#2BA84A';
function setDebugColours(on) { debugColours = on; buildGrid(); redraw(); }


function setup() {
  const c = createCanvas(canvasSize(), canvasSize());
  c.parent('stage');
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) spin = 0;
  drawFaceKey();
  rollDice();
  applyLoop();
}

// Animate only while the disc is visible and actually turning
function applyLoop() {
  if (discOn && spin > 0) loop();
  else { noLoop(); redraw(); }
}

function setDisc(on) { discOn = on; applyLoop(); redraw(); }
function setDiscPattern(name) { discPattern = name; redraw(); }
function setSecondDisc(on) { disc2On = on; redraw(); }
function setDiscBehind(on) { discBehind = on; buildGrid(); redraw(); }
function setSpin(degPerSec) { spin = degPerSec; applyLoop(); }
function setShowDice(on) { showDice = on; redraw(); }

// Draw one example of each face into the key, if the page has one
const keyLayers = {};
function drawFaceKey(refresh) {
  for (let v = 1; v <= 6; v++) {
    const slot = document.getElementById('face-' + v);
    if (!slot) continue;
    const size = 96;
    if (refresh && keyLayers[v]) {
      keyLayers[v].clear();
      drawTile(v, 1, 1, 0, 0, size, keyLayers[v]);
      continue;
    }
    const pg = createGraphics(size, size);
    keyLayers[v] = pg;
    drawTile(v, 1, 1, 0, 0, size, pg);
    pg.elt.style.display = 'block';
    pg.elt.style.width = '100%';
    pg.elt.style.height = 'auto';
    slot.appendChild(pg.elt);
  }
}

function canvasSize() {
  const el = document.getElementById('stage');
  return Math.floor(Math.min(el ? el.clientWidth : 600, 640));
}

function windowResized() {
  resizeCanvas(canvasSize(), canvasSize());
  buildGrid();
  redraw();
}

function rollDice() {
  dice = [];
  turns = [];
  inverts = [];
  for (let r = 0; r < N; r++) {
    const faceRow = [];
    const turnRow = [];
    const invertRow = [];
    for (let c = 0; c < N; c++) {
      faceRow.push(rollFace(r));
      turnRow.push(floor(random(1, 7)));
      invertRow.push(floor(random(1, 7)));
    }
    dice.push(faceRow);
    turns.push(turnRow);
    inverts.push(invertRow);
  }
  rollCount++;
  buildGrid();
  redraw();
  if (typeof onRolled === 'function') onRolled(dice, turns, inverts, rollCount);
}

// Face die for a cell in row r (0-based). Each row has a home face:
// row 1 → 1, row 2 → 2 … row 6 → 6, then it wraps (row 7 → 1).
// There's a 75% chance the cell gets its row's home face; otherwise it
// gets one of the other five faces, each equally likely (5% each).
const HOME_FACE_CHANCE = 0.75;

function rowFace(r) {
  return (r % 6) + 1;
}

function rollFace(r) {
  const home = rowFace(r);
  if (random() < HOME_FACE_CHANCE) return home;
  const others = [1, 2, 3, 4, 5, 6].filter(f => f !== home);
  return random(others);
}

function setGridSize(n) {
  N = n;
  rollDice();
}

// Render the tiles into an offscreen layer so each animation frame only
// has to copy it and draw the disc on top.
function buildGrid() {
  if (!gridLayer || gridLayer.width !== width) {
    if (gridLayer) gridLayer.remove();
    gridLayer = createGraphics(width, height);
  }
  // Behind: the layer starts clear so the disc shows through the light areas.
  // In front: the layer is solid paper and the disc is drawn over it.
  if (discBehind) gridLayer.clear();
  else gridLayer.background(PAPER);
  const cell = width / N;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      drawTile(dice[r][c], turns[r][c], inverts[r][c], r, c, cell, gridLayer, discBehind);
}

function draw() {
  if (!gridLayer) return;

  // BEHIND: think of the grid as printed on clear film. The ink is solid and
  // every light area is see-through, so the disc only shows in the gaps
  // between dark bands (and inside light bands on inverted tiles).
  // IN FRONT: the grid is solid and the disc's black stripes lie over it.
  background(PAPER);
  if (!discBehind) image(gridLayer, 0, 0, width, height);
  if (discOn) {
    drawDisc(discAngle);
    // the second disc turns at the same speed in the opposite direction;
    // where their stripes cross, the moiré doubles up
    if (disc2On) drawDisc(-discAngle + DISC2_OFFSET);
    discAngle += radians(spin) * (deltaTime / 1000);
  }
  if (discBehind) image(gridLayer, 0, 0, width, height);

  if (showDice) {
    const cell = width / N;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        drawDie(dice[r][c], c * cell, r * cell, cell, 'face');      // top-left
        drawDie(inverts[r][c], c * cell, r * cell, cell, 'invert'); // top-right
        drawDie(turns[r][c], c * cell, r * cell, cell, 'turn');     // bottom-right
      }
  }
}

// The disc: parallel stripes or a spiral, same width and spacing as the face bands,
// black stripes with transparent gaps between them.
function drawDisc(angle) {
  const cell = width / N;
  const W = bandWidth(cell);         // same band width as the tiles
  const P = bandSpacing(cell);       // same spacing as the tiles
  // centre is offset; the radius reaches the farthest corner so the disc still covers the whole grid
  const cx = width * (0.5 + DISC_OFFSET);
  const cy = height * (0.5 + DISC_OFFSET);
  const R = Math.hypot(max(cx, width - cx), max(cy, height - cy));

  push();
  translate(cx, cy);
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.arc(0, 0, R, 0, TWO_PI);
  drawingContext.clip();

  rotate(angle);
  // The disc is solid black stripes; everything between them is left
  // untouched, i.e. transparent, like stripes printed on clear film.
  const discInk = '#000000';

  if (discPattern === 'spiral') {
    // Archimedean spiral: the band moves outward by one spacing (P) per turn,
    // so neighbouring arms sit P apart, the same as the tile bands.
    // Spinning it makes the arms seem to flow outward or inward.
    noFill();
    stroke(discInk);
    strokeWeight(W);
    strokeCap(SQUARE);
    strokeJoin(ROUND);
    const maxTheta = (R / P + 1) * TWO_PI;
    beginShape();
    for (let th = 0; th <= maxTheta; th += 0.03) {
      const rad = (P * th) / TWO_PI;
      vertex(rad * cos(th), rad * sin(th));
    }
    endShape();
  } else if (discPattern === 'widening') {
    // Parallel stripes whose spacing grows steadily across the disc.
    // Through the disc's centre the spacing matches the tile bands; toward one
    // edge it shrinks to 1/WIDEN_RANGE of that, toward the other it grows to
    // WIDEN_RANGE times. Stripe-to-gap share follows the band width setting.
    noStroke();
    fill(discInk);
    let y = -R;
    while (y < R) {
      const spacing = P * Math.pow(WIDEN_RANGE, y / R);
      rect(-R, y, 2 * R, spacing * bandRatio);
      y += spacing;
    }
  } else {
    // straight parallel stripes
    noStroke();
    fill(discInk);
    const n = ceil(R / P) + 1;
    for (let k = -n; k <= n; k++) rect(-R, k * P - W / 2, 2 * R, W);
  }


  drawingContext.restore();
  pop();
}

// Band geometry for a tile of side s. The diagonal (s·√2) is split into six
// equal slots, so band starts cross the tile's sides at exact sixths.
function bandSpacing(s) {
  return (s * Math.SQRT2) / 6;   // centre to centre, fixed: six slots along the diagonal
}

function bandWidth(s) {
  return bandSpacing(s) * bandRatio;
}

// Share of each slot taken up by the band (the rest is gap). Adjustable.
// At 0.5 (equal band and gap) every edge meets its neighbour from any corner;
// at other widths the leading edges still meet but the trailing edges don't.
let bandRatio = 0.5;
function setBandRatio(f) { bandRatio = f; buildGrid(); drawFaceKey(true); redraw(); }

// g is an optional p5.Graphics to draw into (used for the face key);
// without it the tile is drawn on the main canvas.
// seeThrough: leave the light areas transparent instead of painting paper
function drawTile(v, t, k, r, c, s, g, seeThrough) {
  const p = g || window;
  const ctx = g ? g.drawingContext : drawingContext;
  const h = s / 2;
  // invert die: 4–6 swaps ink and paper
  const inverted = k >= 4;
  const tileInk = debugColours ? DEBUG_INK : INK;
  const tilePaper = debugColours ? DEBUG_PAPER : PAPER;
  const ground = inverted ? tileInk : tilePaper;
  const band = inverted ? tilePaper : tileInk;

  p.push();
  p.translate(c * s, r * s);

  // clip to the cell so motifs can bleed off the edge cleanly
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, s, s);
  ctx.clip();

  p.noStroke();
  if (!(seeThrough && !inverted)) {   // light ground stays clear when see-through
    p.fill(ground);
    p.rect(0, 0, s, s);
  }

  p.translate(h, h);
  // turn die: which corner the bands start from
  //   1 or 5 → bottom-left, 2 or 6 → top-left, 3 → top-right, 4 → bottom-right
  p.rotate(((t - 1) % 4) * HALF_PI);
  p.rotate(QUARTER_PI); // bands run on the diagonal; local +y now points at the start corner

  // The face die sets how many bands there are. They stack outward from the
  // start corner. Bands and gaps are equal, and 6 bands + 6 gaps = the diagonal.
  // That makes every band edge cross the tile's sides at exact sixths of the
  // side, from any starting corner, so edges always meet the edges in the
  // neighbouring tiles however each tile is turned.
  const D = s * Math.SQRT1_2;        // centre to corner, along the diagonal
  const W = bandWidth(s);            // every band is this width (adjustable)
  const P = bandSpacing(s);          // centre-to-centre spacing, fixed
  // light bands on a see-through layer are cut out as clear holes
  const cutOut = seeThrough && inverted && g;
  if (cutOut) g.erase();
  else p.fill(band);
  p.noStroke();
  for (let i = 0; i < v; i++) {
    const y = D - i * P;             // first band starts right on the corner
    p.rect(-s, y - W, s * 2, W);
  }
  if (cutOut) g.noErase();

  ctx.restore();
  p.pop();
}

// Small dice in the cell's corners:
//   white, top-left = face die · grey, top-right = invert die · dark, bottom-right = turn die
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
};

function drawDie(v, x, y, s, kind) {
  const d = s * 0.3;
  const m = s * 0.05;
  const st = DIE_STYLE[kind];
  push();
  if (kind === 'turn') translate(x + s - m - d / 2, y + s - m - d / 2);
  else if (kind === 'invert') translate(x + s - m - d / 2, y + m + d / 2);
  else translate(x + m + d / 2, y + m + d / 2);
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
  if (key === ' ' || key === 'r' || key === 'R') {
    rollDice();
    return false;
  }
}
