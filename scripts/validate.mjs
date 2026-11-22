import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (message) => errors.push(message);

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function frontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const found = line.match(/^([A-Za-z0-9]+):\s*(.*)$/);
    if (!found) continue;
    data[found[1]] = found[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { data, body: raw.slice(match[0].length) };
}

const authors = JSON.parse(read('src/data/authors.json')).map((item) => item.slug);
const categories = ['sarj', 'menzil', 'maliyet', 'alim', 'modeller', 'mevzuat', 'inceleme', 'bakim'];
const clickbait = ['şok', 'inanılmaz', 'kaçırma', 'flaş haber', 'bomba gibi'];
const required = ['title', 'description', 'type', 'category', 'author', 'publishedAt', 'updatedAt'];
const contentDir = join(root, 'src', 'content', 'articles');
const slugs = new Set();

for (const folder of readdirSync(contentDir)) {
  const dir = join(contentDir, folder);
  for (const file of readdirSync(dir)) {
    if (!/\.(md|mdx)$/i.test(file)) continue;
    const slug = file.replace(/\.(md|mdx)$/i, '');
    const key = `${folder}/${slug}`;
    if (slugs.has(key)) fail(`Yinelenen slug: ${key}`);
    slugs.add(key);
    const parsed = frontmatter(read(`src/content/articles/${folder}/${file}`));
    if (!parsed) {
      fail(`${key}: frontmatter yok`);
      continue;
    }
    for (const field of required) {
      if (!parsed.data[field]) fail(`${key}: ${field} yok`);
    }
    if (parsed.data.type && parsed.data.type !== folder && folder !== 'karsilastirma') {
      if (parsed.data.type !== folder) fail(`${key}: type (${parsed.data.type}) klasörle aynı değil`);
    }
    if (parsed.data.author && !authors.includes(parsed.data.author)) fail(`${key}: yazar yok`);
    if (parsed.data.category && !categories.includes(parsed.data.category)) fail(`${key}: kategori yok`);
    const title = parsed.data.title ?? '';
    const description = parsed.data.description ?? '';
    if (title.length < 12 || title.length > 100) fail(`${key}: başlık uzunluğu ${title.length}`);
    if (description.length < 40 || description.length > 180) fail(`${key}: açıklama uzunluğu ${description.length}`);
    const lowered = title.toLocaleLowerCase('tr-TR');
    for (const word of clickbait) {
      if (lowered.includes(word)) fail(`${key}: başlıkta abartı (“${word}”)`);
    }
    const published = Date.parse(parsed.data.publishedAt ?? '');
    const updated = Date.parse(parsed.data.updatedAt ?? '');
    if (Number.isNaN(published) || Number.isNaN(updated)) fail(`${key}: tarih okunamadı`);
    else if (updated < published) fail(`${key}: güncelleme yayın tarihinden önce`);
    const rawArticle = read(`src/content/articles/${folder}/${file}`);
    const hasSourceUrl = /url:\s*['"]?https?:\/\//i.test(rawArticle);
    if (!hasSourceUrl) {
      const stripped = parsed.body.replace(/100 km/g, '').replace(/10-80%/g, '');
      const invented = stripped.match(/\d+(?:[.,]\d+)?\s*(km|kwh|tl|₺|kw|dk)\b/i);
      if (invented) fail(`${key}: kaynak URL’si yokken metinde sayı var (“${invented[0]}”)`);
    }
  }
}

function checkNumbered(file, rows, label) {
  for (const row of rows) {
    const numbers = ['priceTry', 'rangeKm', 'batteryKwh', 'dcKw', 'charge10to80Min', 'pricePerKwhTry', 'pricePerLitreTry'].filter(
      (key) => typeof row[key] === 'number',
    );
    if (!numbers.length) continue;
    const source = row.source ?? file.source;
    const updated = row.updatedAt ?? file.updatedAt;
    if (!source?.url || !updated) {
      fail(`${label} ${row.id || row.name}: sayı var ama kaynak URL’si veya güncelleme tarihi yok (${numbers.join(', ')})`);
    }
  }
}

const cars = JSON.parse(read('src/data/cars.json'));
const carSlugs = new Set();
for (const car of cars) {
  if (!car.slug || !car.name) fail('Araç kaydında slug veya ad yok');
  if (car.slug.includes('-vs-')) fail(`${car.slug}: slug -vs- içeremez`);
  if (carSlugs.has(car.slug)) fail(`Yinelenen araç slug’ı: ${car.slug}`);
  carSlugs.add(car.slug);
  checkNumbered('cars.json', [car], 'Araç');
}

const tariffs = JSON.parse(read('src/data/tariffs.json'));
checkNumbered(tariffs, tariffs.items, 'Tarife');
if (Array.isArray(tariffs.fuels)) checkNumbered(tariffs, tariffs.fuels, 'Yakıt');

const redirects = JSON.parse(read('src/data/redirects.json'));
for (const item of redirects) {
  if (!item.from?.startsWith('/') || !item.to?.startsWith('/')) fail('Yönlendirme / ile başlamalı');
  if (item.from === item.to) fail(`Yönlendirme kendine dönüyor: ${item.from}`);
  if (item.from.endsWith('/') || item.to.endsWith('/')) fail(`Yönlendirmede sonda / olmasın: ${item.from}`);
}

if (!slugs.has('rehber/elektrikli-arac-almadan-once')) fail('Örnek satın alma rehberi yok');
if (!slugs.has('haber/sarj-tarifesinde-bakilacak-satirlar')) fail('Örnek tarife haberi yok');
if (!slugs.has('rehber/evde-sarj-istasyonu-kurulumu')) fail('Örnek kurulum rehberi yok');

if (errors.length) {
  console.error(errors.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`Doğrulama tamam: ${slugs.size} yazı, ${cars.length} araç, ${tariffs.items.length} tarife.`);
