const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'dist';

const VARIANTS = [
  { file: 'github-contribution-grid-snake.svg', bright: '#40c463', mid: '#30a14e' },
  { file: 'github-contribution-grid-snake-dark.svg', bright: '#00c647', mid: '#0f6d31' },
];

const FOOD_COUNT = 220;
const SCATTER_R = 2;
const SNAKE_CYAN = '#00b3c4';
const GRID_X0 = 2;
const GRID_Y = [2, 18, 34, 50, 66, 82, 98];
const PITCH = 16;

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

function extractKeyframes(style, name) {
  const i = style.indexOf('@keyframes ' + name + '{');
  if (i < 0) return null;
  let d = 0, j = i;
  for (; j < style.length; j++) {
    if (style[j] === '{') d++;
    else if (style[j] === '}') { d--; if (d === 0) break; }
  }
  return style.slice(i, j + 1);
}

// Parse the head (s0) keyframes into waypoints sorted by percentage.
function headWaypoints(style) {
  const kf = extractKeyframes(style, 's0');
  if (!kf) throw new Error('no @keyframes s0 found');
  const pts = [];
  const re = /([\d.,%\s]+)\{transform:translate\((-?\d+(?:\.\d+)?)px,(-?\d+(?:\.\d+)?)px\)\}/g;
  let m;
  while ((m = re.exec(kf))) {
    const pcts = m[1].split(',').map((s) => parseFloat(s.trim()));
    for (const p of pcts) pts.push({ p, x: +m[2], y: +m[3] });
  }
  pts.sort((a, b) => a.p - b.p);
  return pts;
}

// Expand head waypoints into per-cell (16px) arrival times.
function cellArrivalTimes(waypoints) {
  const times = new Map(); // "x,y" -> earliest arrival %
  const visit = (x, y, p) => {
    if (y < 0) return;
    const k = x + ',' + y;
    if (!times.has(k)) times.set(k, p);
  };
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist % PITCH !== 0 || dist === 0) continue;
    const steps = dist / PITCH;
    const sx = dx === 0 ? 0 : dx / dist * PITCH;
    const sy = dy === 0 ? 0 : dy / dist * PITCH;
    for (let s = (i === 0 ? 1 : 0); s <= steps; s++) {
      visit(a.x + sx * s, a.y + sy * s, a.p + ((b.p - a.p) * s) / steps);
    }
  }
  return times;
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
  for (let x = GRID_X0; x <= lastColX; x += PITCH) {
    for (const y of GRID_Y) {
      if (!have.has(x + ',' + y)) added += '<rect data-add="1" class="c" x="' + x + '" y="' + y + '" rx="2" ry="2"/>\n';
    }
  }

  const styleMatch = svg.match(/<style>([\s\S]*?)<\/style>/);
  if (!styleMatch) throw new Error(file + ': no <style> block');
  const arrivals = cellArrivalTimes(headWaypoints(styleMatch[1]));

  // Index empty cells (class exactly "c") by position; food rect = head pos + 2.
  const cellPos = new Map();
  const re = /<rect class="c" x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"/g;
  let m;
  while ((m = re.exec(svg))) cellPos.set(+m[1] - 2 + ',' + (+m[2] - 2), [+m[1], +m[2]]);

  // Food scatters over the path itself and its surrounding cells (radius SCATTER_R).
  // Off-path food is eaten shortly after the head passes the nearest path cell.
  const candidates = [];
  for (const [key, cell] of cellPos) {
    const [hx, hy] = key.split(',').map(Number);
    let best = null;
    for (let dx = -SCATTER_R; dx <= SCATTER_R; dx++) {
      for (let dy = -SCATTER_R; dy <= SCATTER_R; dy++) {
        const t = arrivals.get(hx + dx * PITCH + ',' + (hy + dy * PITCH));
        if (t !== undefined) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          if (!best || t + d * 0.12 < best.t) best = { t: t + d * 0.12, d };
        }
      }
    }
    if (best) candidates.push({ xy: cell, t: Math.min(best.t, 99.9), d: best.d });
  }

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
  console.log(file + ': +' + n + ' eatable food, +' + (added.match(/<rect/g) || []).length + ' completed cells');
}

const rnd = mulberry32(dateSeed());
for (const v of VARIANTS) enrich(v, rnd);
