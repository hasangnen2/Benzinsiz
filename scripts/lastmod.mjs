import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function frontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const found = line.match(/^([A-Za-z0-9]+):\s*(.*)$/);
    if (!found) continue;
    data[found[1]] = found[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return data;
}

function stamp(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function later(current, next) {
  if (next == null) return current;
  if (current == null || next > current) return next;
  return current;
}

export function buildSeoIndex() {
  const lastmod = new Map();
  const pages = readJson('src/data/page-dates.json');
  for (const [path, date] of Object.entries(pages)) {
    const time = stamp(date);
    if (time != null) lastmod.set(path, new Date(time).toISOString());
  }

  const contentDir = join(root, 'src', 'content', 'articles');
  const groups = { haber: null, rehber: null };
  const categories = new Map();
  const authors = new Map();
  const categoryCounts = new Map();

  for (const folder of readdirSync(contentDir, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const dir = join(contentDir, folder.name);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      const data = frontmatter(readFileSync(join(dir, file), 'utf8'));
      if (data.draft === 'true') continue;
      const slug = file.replace(/\.(md|mdx)$/i, '');
      const updated = stamp(data.updatedAt || data.publishedAt);
      const type = folder.name === 'haber' || folder.name === 'rehber' ? folder.name : data.type;
      if (type === 'haber' || type === 'rehber') {
        const path = `/${type}/${slug}`;
        if (updated != null) lastmod.set(path, new Date(updated).toISOString());
        groups[type] = later(groups[type], updated);
      }
      if (data.category && updated != null) {
        categories.set(data.category, later(categories.get(data.category) ?? null, updated));
        categoryCounts.set(data.category, (categoryCounts.get(data.category) ?? 0) + 1);
      }
      if (data.author && updated != null) {
        authors.set(data.author, later(authors.get(data.author) ?? null, updated));
      }
    }
  }

  if (groups.haber != null) lastmod.set('/haber', new Date(groups.haber).toISOString());
  if (groups.rehber != null) lastmod.set('/rehber', new Date(groups.rehber).toISOString());
  for (const [slug, time] of categories) {
    lastmod.set(`/kategori/${slug}`, new Date(time).toISOString());
  }
  for (const [slug, time] of authors) {
    lastmod.set(`/yazar/${slug}`, new Date(time).toISOString());
  }

  const noindex = new Set(['/ara']);
  const knownCategories = [
    'sarj',
    'menzil',
    'maliyet',
    'alim',
    'modeller',
    'mevzuat',
    'inceleme',
    'bakim',
  ];
  for (const slug of knownCategories) {
    if (!categoryCounts.get(slug)) noindex.add(`/kategori/${slug}`);
  }

  return { lastmod, noindex };
}
