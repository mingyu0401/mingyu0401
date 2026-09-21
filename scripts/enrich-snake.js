const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'dist';

const VARIANTS = [
  { file: 'github-contribution-grid-snake.svg', bright: '#40c463', mid: '#30a14e' },
  { file: 'github-contribution-grid-snake-dark.svg', bright: '#00c647', mid: '#0f6d31' },
];

const FOOD_COUNT = 108;

// snake path from the s0 keyframes (translate waypoints), same for all segments
const PATH_PTS = [
  [0, -16], [0, 0], [32, 0], [32, 32], [0, 32], [0, 96], [736, 96],
  [736, 48], [816, 48], [816, 96], [832, 96], [832, 0], [64, 0], [64, -16],
];

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

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}

function onSnakePath(cx, cy) {
  for (let i = 0; i < PATH_PTS.length - 1; i++) {
    if (distToSeg(cx, cy, ...PATH_PTS[i], ...PATH_PTS[i + 1]) < 9) return true;
  }
  return false;
}

function enrich({ file, bright, mid }, rnd) {
  const p = path.join(dir, file);
  let svg = fs.readFileSync(p, 'utf8');
  const candidates = [];
  const re = /<rect class="(c(?: c\d+)?)" x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"/g;
  let m;
  while ((m = re.exec(svg))) {
    if (m[1] !== 'c') continue; // already a food cell
    const x = m[2], y = m[3];
    if (!onSnakePath(+x + 6, +y + 6)) candidates.push([x, y]);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const n = Math.min(FOOD_COUNT, candidates.length);
  let out = '';
  for (let i = 0; i < n; i++) {
    const fill = rnd() < 0.7 ? bright : mid;
    out += `<rect class="c" x="${candidates[i][0]}" y="${candidates[i][1]}" rx="2" ry="2" style="fill:${fill}"/>\n`;
  }
  svg = svg.replace('</svg>', out + '</svg>');
  fs.writeFileSync(p, svg);
  console.log(`${file}: +${n} food cells`);
}

const rnd = mulberry32(dateSeed());
for (const v of VARIANTS) enrich(v, rnd);
