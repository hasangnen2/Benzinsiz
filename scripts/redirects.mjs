import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

/** Kalıcı karşılaştırma adresi slug sırasına göredir. Ters sıra 301 döner. */
export function comparisonRedirects(cars) {
  const slugs = cars.map((car) => car.slug).sort((a, b) => a.localeCompare(b, 'tr'));
  const redirects = [];
  for (let i = 0; i < slugs.length; i += 1) {
    for (let j = i + 1; j < slugs.length; j += 1) {
      redirects.push({
        from: `/karsilastir/${slugs[j]}-vs-${slugs[i]}`,
        to: `/karsilastir/${slugs[i]}-vs-${slugs[j]}`,
      });
    }
  }
  return redirects;
}

export function collectRedirects() {
  const manual = readJson('src/data/redirects.json');
  const cars = readJson('src/data/cars.json');
  const combined = [
    ...manual.map((item) => ({ from: item.from, to: item.to })),
    ...comparisonRedirects(cars),
  ];
  const seen = new Set();
  return combined.filter((item) => {
    if (seen.has(item.from)) return false;
    seen.add(item.from);
    return true;
  });
}

export function astroRedirectMap() {
  const map = {};
  for (const item of collectRedirects()) {
    map[item.from] = { status: 301, destination: item.to };
  }
  return map;
}
