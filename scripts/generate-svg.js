const fs = require('fs');
const path = require('path');

const WEEKS = 53;
const DAYS = 7;
const CELL = 12;
const GAP = 3;

const dir = process.argv[2] || 'dist';
fs.mkdirSync(dir, { recursive: true });

// Generate pseudo-random contributions based on day-of-week
function pseudoRand(week, day) {
  let h = ((week * 7 + day) * 2654435761) >>> 0;
  h = (h ^ (h >>> 16));
  return ((h >>> 0) / 4294967296);
}

function buildSvg(palette) {
  const W = WEEKS * (CELL + GAP);
  const H = DAYS * (CELL + GAP);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\n`;
  svg += `<style>\n`;
  svg += `.c{fill:${palette.empty}}\n`;
  svg += `.c1{fill:${palette.l1}}\n`;
  svg += `.c2{fill:${palette.l2}}\n`;
  svg += `.c3{fill:${palette.l3}}\n`;
  svg += `.c4{fill:${palette.l4}}\n`;
  svg += `.s{fill:${palette.snakesnake}}\n`;
  svg += `</style>\n`;

  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < DAYS; d++) {
      const x = w * (CELL + GAP);
      const y = d * (CELL + GAP);
      const r = pseudoRand(w, d);
      const level = r < 0.25 ? 'c' : r < 0.45 ? 'c1' : r < 0.65 ? 'c2' : r < 0.82 ? 'c3' : 'c4';
      svg += `<rect class="${level}" x="${x}" y="${y}" width="${CELL}" height="${CELL}"/>\n`;
    }
  }
  svg += '</svg>';
  return svg;
}

const light = {
  empty: '#ebedf0',
  l1: '#9be9a8',
  l2: '#40c463',
  l3: '#30a14e',
  l4: '#216e39',
  snakesnake: '#216e39',
};

const dark = {
  empty: '#161b22',
  l1: '#0e4429',
  l2: '#006d32',
  l3: '#26a641',
  l4: '#39d353',
  snakesnake: '#39d353',
};

fs.writeFileSync(path.join(dir, 'github-contribution-grid-snake.svg'), buildSvg(light));
fs.writeFileSync(path.join(dir, 'github-contribution-grid-snake-dark.svg'), buildSvg(dark));
console.log('Generated SVGs');
