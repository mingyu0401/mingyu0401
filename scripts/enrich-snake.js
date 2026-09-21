const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'dist';

const VARIANTS = [
  { file: 'github-contribution-grid-snake.svg', bright: '#40c463', mid: '#30a14e' },
  { file: 'github-contribution-grid-snake-dark.svg', bright: '#00c647', mid: '#0f6d31' },
];

const PATH_LEN = 250;   // the head walks this many steps, revisiting cells is expected
const FOOD_COUNT = 125; // randomly chosen from the empty cells the route visited
const SNAKE_CYAN = '#00b3c4';
const CYCLE_MS = 21600; // snk default is 13500ms; longer cycle = slower snake
const PITCH = 16;
const ROWS = 7;
const GRID_X0 = 2; // cell rect x; head coord = rect coord - 2
const GRID_Y = [2, 18, 34, 50, 66, 82, 98];
const T_FIRST = 0.74; // % when head reaches the first cell
const T_LAST = 98.5;  // % when head finishes the route

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

// Random walk over the grid (col,row). Contribution cells are mandatory
// checkpoints: the walk heads toward each one (mostly greedily, sometimes
// randomly) so the snake still eats all of its own data cells, then keeps
// wandering randomly until PATH_LEN steps. Cells may be revisited.
function randomRoute(cols, checkpoints, rnd) {
  const cells = [[0, 0]];
  let cur = [0, 0];
  const neighbors = (x, y) => {
    const out = [];
    if (x > 0) out.push([x - 1, y]);
    if (x < cols - 1) out.push([x + 1, y]);
    if (y > 0) out.push([x, y - 1]);
    if (y < ROWS - 1) out.push([x, y + 1]);
    return out;
  };
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  const seen = new Set(['0,0']);
  for (const goal of checkpoints) {
    while (cur[0] !== goal[0] || cur[1] !== goal[1]) {
      const opts = neighbors(cur[0], cur[1]).sort((a, b) => dist(a, goal) - dist(b, goal) || rnd() - 0.5);
      cur = rnd() < 0.8 ? opts[0] : opts[Math.floor(rnd() * opts.length)];
      cells.push(cur);
      seen.add(cur.join(','));
    }
  }
  while (cells.length < PATH_LEN) {
    const prev = cells[cells.length - 2];
    let opts = neighbors(cur[0], cur[1]);
    const fwd = opts.filter(([x, y]) => !(x === prev[0] && y === prev[1]));
    if (fwd.length) opts = fwd; // avoid immediate back-and-forth while wandering
    const fresh = opts.filter(([x, y]) => !seen.has(x + ',' + y));
    const pool = fresh.length && rnd() < 0.85 ? fresh : opts; // explore new ground when possible
    cur = pool[Math.floor(rnd() * pool.length)];
    cells.push(cur);
    seen.add(cur.join(','));
  }
  return cells;
}

// Timed head track: entry from above, one point per step, exit straight down
// out of the grid after the last cell. The track ends 3*step before 100% so
// the three trailing body segments still fit inside the cycle.
function buildTrack(cells, step) {
  const track = [{ x: 0, y: -16, t: 0 }];
  cells.forEach(([c, r], k) => track.push({ x: c * PITCH, y: r * PITCH, t: T_FIRST + k * step }));
  const endT = 100 - 3 * step;
  const last = track[track.length - 1];
  const nExit = Math.ceil((112 - last.y) / PITCH);
  for (let j = 1; j <= nExit; j++)
    track.push({ x: last.x, y: last.y + j * PITCH, t: last.t + (endT - last.t) * j / nExit });
  return track;
}

// Drop points that lie on the straight line between their neighbours AND move
// at the same per-step time — linear CSS interpolation between the remaining
// corners then reproduces every exact per-step time (entry/exit segments run
// at a different pace than the walk, so their junctions must stay corners).
function cornersOf(track) {
  const pts = [track[0]];
  for (let i = 1; i < track.length - 1; i++) {
    const a = track[i - 1], b = track[i], c = track[i + 1];
    const turned = c.x - b.x !== b.x - a.x || c.y - b.y !== b.y - a.y;
    const sped = Math.abs((c.t - b.t) - (b.t - a.t)) > 0.001;
    if (turned || sped) pts.push(b);
  }
  pts.push(track[track.length - 1]);
  return pts;
}

function translate(x, y) { return 'transform:translate(' + x + 'px,' + y + 'px)'; }

function headKeyframes(corners) {
  return '@keyframes s0{' + corners.map((p) => p.t.toFixed(2) + '%{' + translate(p.x, p.y) + '}').join('') + '}';
}

// Body segment i trails the head by i*step, resting in a row above the grid
// before it sets off (same as snk's original rendering).
function segKeyframes(i, corners, step) {
  let kf = '@keyframes s' + i + '{0%{' + translate(i * PITCH, -16) + '}';
  for (const p of corners) {
    const t = Math.min(p.t + i * step, 100);
    kf += t.toFixed(2) + '%{' + translate(p.x, p.y) + '}';
  }
  return kf + '}';
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

  // Slower: stretch the snk cycle so the whole walk takes ~1.6x longer.
  svg = svg.replace(/13500ms/g, CYCLE_MS + 'ms');

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

  // Contribution cells (cN order = eating order) are the route checkpoints.
  const contribPos = new Map();
  for (const m of svg.matchAll(/<rect class="c (c\d+)" x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"/g))
    contribPos.set(m[1], [(+m[2] - 2) / PITCH, (+m[3] - 2) / PITCH]);
  const checkpoints = [...contribPos.entries()]
    .sort((a, b) => +a[0].slice(1) - +b[0].slice(1))
    .map((e) => e[1]);

  const cells = randomRoute(cols, checkpoints, rnd);
  const step = (T_LAST - T_FIRST) / (cells.length - 1);
  const corners = cornersOf(buildTrack(cells, step));
  svg = replaceKeyframes(svg, 's0', headKeyframes(corners));
  for (let i = 1; i <= 3; i++) svg = replaceKeyframes(svg, 's' + i, segKeyframes(i, corners, step));

  // Bottom bar grows linearly with the walk instead of the old eating steps.
  svg = replaceKeyframes(svg, 'u0',
    '@keyframes u0{0%,' + T_FIRST + '%{transform:scale(0.000,1)}' + T_LAST + '%,100%{transform:scale(1.000,1)}}');

  // First-visit time of every cell on the route.
  const arrival = new Map();
  cells.forEach(([c, r], k) => {
    const key = c * PITCH + ',' + r * PITCH;
    if (!arrival.has(key)) arrival.set(key, T_FIRST + k * step);
  });

  // Re-time contribution cells so they go dark exactly when the head arrives.
  for (const [name, [col, row]] of contribPos) {
    const old = extractKeyframes(svg, name);
    if (!old) continue;
    const color = (old.match(/fill:var\((--c\d)\)/) || [])[1] || '--c4';
    const t = Math.min(arrival.get(col * PITCH + ',' + row * PITCH) ?? 99.9, 99.9);
    const on = t.toFixed(2), off = Math.min(t + 0.02, 100).toFixed(2);
    svg = replaceKeyframes(svg, name,
      '@keyframes ' + name + '{' + on + '%{fill:var(' + color + ')}' + off + '%,100%{fill:var(--ce)}}');
  }

  // Food: randomly pick FOOD_COUNT of the EMPTY cells the route visited;
  // each is eaten exactly when the head first arrives there.
  const candidates = [];
  const collect = (x, y) => {
    const t = arrival.get((x - 2) + ',' + (y - 2));
    if (t !== undefined) candidates.push({ xy: [x, y], t });
  };
  for (const m of svg.matchAll(/<rect class="c" x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"/g)) collect(+m[1], +m[2]);
  for (const m of added.matchAll(/<rect data-add="1" class="c" x="(\d+)" y="(\d+)"/g)) collect(+m[1], +m[2]);

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const n = Math.min(FOOD_COUNT, candidates.length);

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
  const visited = new Set(cells.map(([c, r]) => c + ',' + r)).size;
  console.log(file + ': route ' + cells.length + ' steps (' + visited + ' distinct cells), +'
    + n + ' food, +' + (added.match(/<rect/g) || []).length + ' completed cells');
}

// Same daily seed for both variants so light and dark show the identical route.
for (const v of VARIANTS) enrich(v, mulberry32(dateSeed()));
