const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'dist';

const PATH_PTS = [
  [0, -16], [0, 0], [32, 0], [32, 32], [0, 32], [0, 96],
  [736, 96], [736, 48], [816, 48], [816, 96], [832, 96], [832, 0],
  [64, 0], [64, -16],
];
const HEAD_PATH = PATH_PTS.map(([x, y]) => [x + 8, y + 8]).concat([[8, -8]]);

const CUM = [0];
for (let i = 0; i < HEAD_PATH.length - 1; i++) {
  const [ax, ay] = HEAD_PATH[i];
  const [bx, by] = HEAD_PATH[i + 1];
  CUM.push(CUM[i] + Math.hypot(bx - ax, by - ay));
}
const TOTAL = CUM[CUM.length - 1];
const T = 32;
const SPEED = TOTAL / T;
const EAT_EVERY = 20;
const BASE_SEGMENTS = 4;

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function onSnakePath(cx, cy) {
  for (let i = 0; i < HEAD_PATH.length - 1; i++) {
    if (distToSeg(cx, cy, HEAD_PATH[i][0], HEAD_PATH[i][1], HEAD_PATH[i + 1][0], HEAD_PATH[i + 1][1]) < 9) return true;
  }
  return false;
}

function projOnPath(cx, cy) {
  let best = { d: Infinity, s: 0 };
  for (let i = 0; i < HEAD_PATH.length - 1; i++) {
    const [ax, ay] = HEAD_PATH[i];
    const [bx, by] = HEAD_PATH[i + 1];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((cx - ax) * dx + (cy - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx, qy = ay + t * dy;
    const d = Math.hypot(cx - qx, cy - qy);
    if (d < best.d) best = { d, s: CUM[i] + t * (CUM[i + 1] - CUM[i]) };
  }
  return best;
}

function parseCells(svg) {
  const cells = [];
  const re = /<rect class="([^"]*)" x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(svg))) {
    const cls = m[1];
    if (cls.startsWith('s') || cls.startsWith('u')) continue;
    const fill = /style="[^"]*fill:(#[0-9a-fA-F]+)/.exec(m[4]);
    cells.push({
      x: +m[2],
      y: +m[3],
      real: /\bc\d+\b/.test(cls),
      grass: fill ? fill[1] : null,
    });
  }
  return cells;
}

function buildPage(inFile, outFile, theme) {
  const svg = fs.readFileSync(path.join(dir, inFile), 'utf8');
  const cells = parseCells(svg);

  const grid = [];
  const corridor = [];
  const food = [];
  for (const c of cells) {
    const cx = c.x + 6, cy = c.y + 6;
    if (onSnakePath(cx, cy)) {
      const proj = projOnPath(cx, cy);
      corridor.push({ ...c, s: proj.s });
    } else {
      grid.push(c);
    }
  }

  // Food: only from grid (off-path), these are cells enriched by enrich-snake.js
  // Corridor cells are NOT food
  for (const c of grid) {
    if (c.grass) food.push(c);
  }

  corridor.sort((a, b) => a.s - b.s);
  food.sort((a, b) => a.s - b.s);

  const fakes = [];
  {
    let alt = 0;
    for (const c of corridor) {
      if (c.real) { alt = (alt + 1) % 2; continue; }
      if (alt % 2 === 0) fakes.push(c);
      alt++;
    }
  }
  const allFood = food.concat(fakes).sort((a, b) => a.s - b.s);
  const growthTimes = [];
  let eaten = 0;
  for (const c of allFood) {
    eaten++;
    if (eaten % EAT_EVERY === 0) growthTimes.push(c.s / SPEED);
  }

  const grassCells = grid.filter((c) => c.grass);
  const dotCells = grid.filter((c) => !c.grass);
  const segMax = BASE_SEGMENTS + growthTimes.length;

  const cellsHtml = [];
  for (const c of dotCells) {
    cellsHtml.push('<rect class="d" x="' + c.x + '" y="' + c.y + '" width="12" height="12" rx="2" ry="2"/>');
  }
  for (const c of grassCells) {
    cellsHtml.push('<rect class="g" x="' + c.x + '" y="' + c.y + '" width="12" height="12" rx="2" ry="2" style="fill:' + c.grass + '"/>');
  }
  for (const c of allFood) {
    const eatTime = (c.s / SPEED).toFixed(3);
    cellsHtml.push('<rect class="f" x="' + c.x + '" y="' + c.y + '" width="12" height="12" rx="2" ry="2" fill="' + theme.foodBright + '" data-eat="' + eatTime + '"/>');
  }
  const snakeHtml = [];
  snakeHtml.push('<rect id="head" x="0" y="0" width="14.4" height="14.4" rx="4.5" ry="4.5"/>');
  for (let i = 1; i < segMax; i++) {
    snakeHtml.push('<rect id="seg' + i + '" x="0" y="0" width="12" height="12" rx="3.5" ry="3.5"/>');
  }

  const segIds = ['#head'].concat(Array.from({ length: segMax - 1 }, (_, i) => '#seg' + (i + 1))).join(',');
  const html = '<!doctype html>\n<html><head><meta charset="utf-8"><style>\nhtml,body{margin:0;padding:0;background:' + theme.bg + '}\nsvg{display:block}\n.d{fill:' + theme.dot + ';stroke:' + theme.stroke + ';stroke-width:1px}\n.f{stroke:' + theme.stroke + ';stroke-width:1px}\n.g{stroke:' + theme.stroke + ';stroke-width:1px}\n' + segIds + '{fill:hsl(0,90%,58%)}\n</style></head><body>\n<svg viewBox="-16 -32 880 192" width="880" height="192" xmlns="http://www.w3.org/2000/svg">\n<g id="cells">\n' + cellsHtml.join('\n') + '\n</g>\n<g id="snake">\n' + snakeHtml.join('\n') + '\n</g>\n</svg>\n<script>\nvar T = ' + T + ', TOTAL = ' + TOTAL + ', SPEED = ' + SPEED + ';\nvar HEAD_PATH = ' + JSON.stringify(HEAD_PATH) + ';\nvar CUM = ' + JSON.stringify(CUM) + ';\nvar EATEN_COLOR = "' + theme.eaten + '";\nvar GROWTH = ' + JSON.stringify(growthTimes) + ';\nfunction posAt(s) {\n  s = ((s % TOTAL) + TOTAL) % TOTAL;\n  var i = 0;\n  while (i < CUM.length - 2 && CUM[i + 1] < s) i++;\n  var t = (s - CUM[i]) / (CUM[i + 1] - CUM[i]);\n  return [HEAD_PATH[i][0] + t * (HEAD_PATH[i + 1][0] - HEAD_PATH[i][0]),\n          HEAD_PATH[i][1] + t * (HEAD_PATH[i + 1][1] - HEAD_PATH[i][1])];\n}\nfunction length(t) {\n  var n = 0;\n  for (var gi = 0; gi < GROWTH.length; gi++) if (t >= GROWTH[gi]) n++;\n  return ' + BASE_SEGMENTS + ' + n;\n}\nvar foodEls = [];\nvar allRects = document.getElementsByTagName("rect");\nfor (var ri = 0; ri < allRects.length; ri++) {\n  if (allRects[ri].className.baseVal === "f") foodEls.push(allRects[ri]);\n}\nfor (var fi = 0; fi < foodEls.length; fi++) {\n  foodEls[fi].dataset.fresh = foodEls[fi].getAttribute("fill");\n}\nvar headEl = document.getElementById("head");\nvar segEls = [];\nfor (var si = 1; si < ' + segMax + '; si++) segEls.push(document.getElementById("seg" + si));\nfunction frame() {\n  var t = ((performance.now() / 1000) % T + T) % T;\n  var sHead = t * SPEED;\n  var L = length(t);\n  var headHue = (sHead / TOTAL * 360) % 360;\n  var pos = posAt(sHead);\n  headEl.setAttribute("transform", "translate(" + (pos[0] - 7.2).toFixed(2) + "," + (pos[1] - 7.2).toFixed(2) + ")");\n  headEl.setAttribute("fill", "hsl(" + headHue.toFixed(1) + ",90%,58%)");\n  for (var i = 0; i < segEls.length; i++) {\n    var el = segEls[i];\n    if (i >= L - 1) { el.style.display = "none"; continue; }\n    el.style.display = "";\n    var sp = posAt(sHead - (i + 1) * 16);\n    el.setAttribute("transform", "translate(" + (sp[0] - 6).toFixed(2) + "," + (sp[1] - 6).toFixed(2) + ")");\n    el.setAttribute("fill", "hsl(" + ((headHue + (i + 1) * 25) % 360).toFixed(1) + ",90%,58%)");\n  }\n  for (var j = 0; j < foodEls.length; j++) {\n    var fel = foodEls[j];\n    fel.setAttribute("fill", t >= +fel.dataset.eat ? EATEN_COLOR : fel.dataset.fresh);\n  }\n  requestAnimationFrame(frame);\n}\nrequestAnimationFrame(frame);\n<\/script></body></html>';
  fs.writeFileSync(path.join(dir, outFile), html);
  console.log(outFile + ': ' + dotCells.length + ' dots, ' + grassCells.length + ' grass, ' + allFood.length + ' food, growth x' + growthTimes.length + ' (' + BASE_SEGMENTS + '->' + segMax + ' segments)');
}

const THEMES = {
  light: { dot: '#31363d', stroke: '#ffffff10', foodBright: '#00c647', bg: '#0d1117', eaten: '#1d222a' },
  dark: { dot: '#31363d', stroke: '#ffffff10', foodBright: '#00c647', bg: '#0d1117', eaten: '#1d222a' },
};

buildPage('github-contribution-grid-snake.svg', 'snake-light.html', THEMES.light);
buildPage('github-contribution-grid-snake-dark.svg', 'snake-dark.html', THEMES.dark);
