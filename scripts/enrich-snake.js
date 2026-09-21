const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'dist';

const VARIANTS = [
  { file: 'github-contribution-grid-snake.svg', bright: '#40c463', mid: '#30a14e' },
  { file: 'github-contribution-grid-snake-dark.svg', bright: '#00c647', mid: '#0f6d31' },
];

const FOOD_CAP = 400;
const SNAKE_CYAN = '#00b3c4';
const PITCH = 16;
const ROWS = 7;
const GRID_X0 = 2; // cell rect x; head coord = rect coord - 2
const GRID_Y = [2, 18, 34, 50, 66, 82, 98];
const T_FIRST = 0.74; // % when head reaches the first cell
const T_LAST = 98.5;  // % when head reaches the last cell

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed() {
  const d = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return h;
}

function extractKeyframes(text, name) {
  const i = text.indexOf('@keyframes ' + name + '{');
  if (i < 0) return null;
  let d = 0, j = i;
  for (; j < text.length; j++) {
    if (text[j] === '{') d++;
    else if (text[j] === '}') { d--; if (d === 0) break; }
  }
  return text.slice(i, j + 1);
}

function replaceKeyframes(svg, name, text) {
  const old = extractKeyframes(svg, name);
  if (!old) throw new Error('missing @keyframes ' + name);
  return svg.replace(old, () => text);
}

// Serpentine sweep of the whole grid in head coords: down even columns,
// up odd columns. Every cell is visited exactly once.
function serpCells(cols) {
  const cells = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < ROWS; r++) {
      cells.push([c * PITCH, (c % 2 === 0 ? r : ROWS - 1 - r) * PITCH]);
    }
  }
  return cells;
}

// Keep only direction-change points (corners) with their cell index — linear
// CSS interpolation between corners reproduces the exact per-cell arrival times.
function cornersOf(cells) {
  const pts = [[cells[0][0], cells[0][1], 0]];
  for (let i = 1; i < cells.length - 1; i++) {
    const [x0, y0] = cells[i - 1], [x1, y1] = cells[i], [x2, y2] = cells[i + 1];
    if (x2 - x1 !== x1 - x0 || y2 - y1 !== y1 - y0) pts.push([x1, y1, i]);
  }
  pts.push([cells[cells.length - 1][0], cells[cells.length - 1][1], cells.length - 1]);
  return pts;
}

function translate(x, y) { return 'transform:translate(' + x + 'px,' + y + 'px)'; }

// Head keyframes: entry from above, timed corners, exit below the grid.
function headKeyframes(corners, step) {
  let kf = '@keyframes s0{0%{' + translate(0, -16) + '}';
  for (const [x, y, k] of corners) kf += (T_FIRST + k * step).toFixed(2) + '%{' + translate(x, y) + '}';
  const last = corners[corners.length - 1];
  kf += (T_LAST + step).toFixed(2) + '%,100%{' + translate(last[0], 112) + '}}';
  return kf;
}

// Body segment i replays the head path i*step behind, waiting off-grid at start.
function segKeyframes(i, corners, step) {
  let kf = '@keyframes s' + i + '{0%{' + translate(0, -16) + '}';
  for (const [x, y, k] of corners) {
    const t = T_FIRST + k * step - i * step;
    if (t > 0.01) kf += t.toFixed(2) + '%{' + translate(x, y) + '}';
  }
  const last = corners[corners.length - 1];
  kf += '100%{' + translate(last[0], 112) + '}}';
  return kf;
}

function enrich({ file, bright, mid }, rnd) {
  const p = path.join(dir, file);
  let svg = fs.readFileSync(p, 'utf8');

  // Strip output of previous runs so re-running is idempotent.
  svg = svg.replace(/<rect class="c" x="[\d.]+" y="[\d.]+" rx="2" ry="2" style="fill:#[0-9a-fA-F]+"\/>\r?\n/g, '');
  svg = svg.replace(/<rect class="c f\d+"[^>]*\/>\r?\n/g, '');
  svg = svg.replace(/<rect data-add="1"[^>]*\/>\r?\n/g, '');
  svg = svg.replace(/:root\{--cf1:[\s\S]*?(?=<\/style>)/, '');

  // Cyan snake: head segments via --cs, body bar follows the same color.
  svg = svg.replace(/--cs:[^;}]+/, '--cs:' + SNAKE_CYAN);
  svg = svg.replace(/(\.u\.u\d+\{)fill:var\(--c4\)/g, '$1fill:var(--cs)');

  // Complete the grid: snk omits not-yet-happened days in the last column.
  const have = new Set([...svg.matchAll(/<rect class="[^"]*" x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"/g)]
    .map((m) => m[1] + ',' + m[2]));
  let added = '';
  const lastColX = Math.max(...[...have].map((k) => +k.split(',')[0]));
  const cols = (lastColX - GRID_X0) / PITCH + 1;
  for (let x = GRID_X0; x <= lastColX; x += PITCH) {
    for (const y of GRID_Y) {
      if (!have.has(x + ',' + y)) added += '<rect data-add="1" class="c" x="' + x + '" y="' + y + '" rx="2" ry="2"/>\n';
    }
  }

  // Rewrite the snake route: serpentine sweep over every cell.
  const cells = serpCells(cols);
  const step = (T_LAST - T_FIRST) / (cells.length - 1);
  const corners = cornersOf(cells);
  svg = replaceKeyframes(svg, 's0', headKeyframes(corners, step));
  for (let i = 1; i <= 3; i++) svg = replaceKeyframes(svg, 's' + i, segKeyframes(i, corners, step));

  // Bottom bar grows linearly with the sweep instead of the old eating steps.
  svg = replaceKeyframes(svg, 'u0',
    '@keyframes u0{0%,' + T_FIRST + '%{transform:scale(0.000,1)}' + T_LAST + '%,100%{transform:scale(1.000,1)}}');

  // Arrival time of every cell on the new route.
  const arrival = new Map();
  cells.forEach(([x, y], k) => arrival.set(x + ',' + y, T_FIRST + k * step));

  // Re-time contribution cells so they go dark exactly when the head arrives.
  const contribPos = new Map();
  for (const m of svg.matchAll(/<rect class="c (c\d+)" x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"/g))
    contribPos.set(m[1], [+m[2] - 2, +m[3] - 2]);
  for (const [name, [hx, hy]] of contribPos) {
    const old = extractKeyframes(svg, name);
    if (!old) continue;
    const color = (old.match(/fill:var\((--c\d)\)/) || [])[1] || '--c4';
    const t = Math.min(arrival.get(hx + ',' + hy) ?? 99.9, 99.9);
    const on = t.toFixed(2), off = Math.min(t + 0.02, 100).toFixed(2);
    svg = replaceKeyframes(svg, name,
      '@keyframes ' + name + '{' + on + '%{fill:var(' + color + ')}' + off + '%,100%{fill:var(--ce)}}');
  }

  // Food: every empty cell the head traverses (= whole grid), eaten on arrival.
  const candidates = [];
  const re = /<rect class="c" x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"/g;
  for (const m of svg.matchAll(re)) {
    const key = (+m[1] - 2) + ',' + (+m[2] - 2);
    const t = arrival.get(key);
    if (t !== undefined) candidates.push({ xy: [+m[1], +m[2]], t });
  }
  for (const m of added.matchAll(/<rect data-add="1" class="c" x="(\d+)" y="(\d+)"/g)) {
    const key = (+m[1] - 2) + ',' + (+m[2] - 2);
    const t = arrival.get(key);
    if (t !== undefined) candidates.push({ xy: [+m[1], +m[2]], t });
  }
  const n = Math.min(FOOD_CAP, candidates.length);

  let css = ':root{--cf1:' + bright + ';--cf2:' + mid + '}';
  let rects = added;
  for (let i = 0; i < n; i++) {
    const c = candidates[i];
    const v = rnd() < 0.7 ? '--cf1' : '--cf2';
    const on = c.t.toFixed(2);
    const off = Math.min(c.t + 0.02, 100).toFixed(2);
    css += '@keyframes f' + i + '{' + on + '%{fill:var(' + v + ')}' + off + '%,100%{fill:var(--ce)}}.c.f' + i + '{fill:var(' + v + ');animation-name:f' + i + '}';
    rects += '<rect class="c f' + i + '" x="' + c.xy[0] + '" y="' + c.xy[1] + '" rx="2" ry="2"/>\n';
  }

  // Food and added cells go BEFORE the snake rects so the snake draws on top.
  svg = svg.replace('</style>', css + '</style>');
  const snakeStart = svg.indexOf('<rect class="u');
  if (snakeStart < 0) throw new Error(file + ': no snake rects found');
  svg = svg.slice(0, snakeStart) + rects + svg.slice(snakeStart);

  fs.writeFileSync(p, svg);
  console.log(file + ': +' + n + ' eatable food on ' + cells.length + '-cell route, +'
    + (added.match(/<rect/g) || []).length + ' completed cells');
}

const rnd = mulberry32(dateSeed());
for (const v of VARIANTS) enrich(v, rnd);
