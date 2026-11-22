import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const cookieName = 'benzinsiz_admin';
const categories = ['sarj', 'menzil', 'maliyet', 'alim', 'modeller', 'mevzuat', 'inceleme', 'bakim'];
const categoryNames = {
  sarj: 'Şarj',
  menzil: 'Menzil',
  maliyet: 'Maliyet',
  alim: 'Satın alma',
  modeller: 'Modeller',
  mevzuat: 'Mevzuat',
  inceleme: 'İncelemeler',
  bakim: 'Bakım',
};
const pageCatalog = [
  { file: 'hakkimizda.astro', href: '/hakkimizda', title: 'Hakkımızda', meta: 'hakkimizda' },
  { file: 'iletisim.astro', href: '/iletisim', title: 'İletişim', meta: 'iletisim' },
  { file: 'gizlilik.astro', href: '/gizlilik', title: 'Gizlilik', meta: 'gizlilik' },
  { file: 'cerez-politikasi.astro', href: '/cerez-politikasi', title: 'Çerez politikası', meta: 'cerez' },
  { file: 'kvkk.astro', href: '/kvkk', title: 'KVKK', meta: 'kvkk' },
  { file: 'kunye.astro', href: '/kunye', title: 'Künye', meta: 'kunye' },
  { file: 'reklam-politikasi.astro', href: '/reklam-politikasi', title: 'Reklam politikası', meta: 'reklam' },
  { file: 'yayin-ilkeleri.astro', href: '/yayin-ilkeleri', title: 'Yayın ilkeleri', meta: 'ilkeler' },
  { file: 'duzeltme-politikasi.astro', href: '/duzeltme-politikasi', title: 'Düzeltme politikası', meta: 'duzeltme' },
];
const clickbait = ['şok', 'inanılmaz', 'kaçırma', 'flaş haber', 'bomba gibi'];
const attempts = new Map();

function contentRoot() {
  return join(root, 'src', 'content', 'articles');
}

function dataPath(name) {
  return join(root, 'src', 'data', name);
}

function password() {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

function secret() {
  const value = password();
  return value ? createHmac('sha256', 'benzinsiz-admin').update(value).digest() : null;
}

function sign(value) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readCookie(req) {
  const header = req.headers.cookie || '';
  const found = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return found ? decodeURIComponent(found.slice(cookieName.length + 1)) : '';
}

function sessionOk(req) {
  const key = secret();
  if (!key) return false;
  const token = readCookie(req);
  const [exp, mac] = token.split('.');
  if (!exp || !mac) return false;
  if (!safeEqual(mac, sign(exp))) return false;
  return Number(exp) > Date.now();
}

function send(res, status, body, extra = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  for (const [name, value] of Object.entries(extra)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('İstek çok büyük.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        reject(new Error('JSON okunamadı.'));
      }
    });
    req.on('error', reject);
  });
}

function clientKey(req) {
  return req.socket?.remoteAddress || 'local';
}

function limited(req) {
  const key = clientKey(req);
  const row = attempts.get(key);
  return row && row.count >= 8 && row.until > Date.now();
}

function noteFailure(req) {
  const key = clientKey(req);
  const row = attempts.get(key) || { count: 0, until: 0 };
  row.count += 1;
  if (row.count >= 8) row.until = Date.now() + 15 * 60 * 1000;
  attempts.set(key, row);
}

function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: raw };
  return {
    data: parse(raw.slice(raw.indexOf('\n') + 1, end)) || {},
    body: raw.slice(end + 4).replace(/^\r?\n/, ''),
  };
}

function articleFile(id) {
  if (!/^(haber|rehber)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return null;
  const [folder, slug] = id.split('/');
  const base = resolve(contentRoot(), folder, `${slug}.md`);
  if (!base.startsWith(resolve(contentRoot()))) return null;
  return base;
}

function listArticles() {
  const rows = [];
  for (const folder of ['haber', 'rehber']) {
    const dir = join(contentRoot(), folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const id = `${folder}/${file.slice(0, -3)}`;
      const full = readFileSync(join(dir, file), 'utf8');
      const { data } = splitFrontmatter(full);
      const sources = Array.isArray(data.sources) ? data.sources : [];
      rows.push({
        id,
        title: String(data.title || ''),
        type: String(data.type || folder),
        category: String(data.category || ''),
        author: String(data.author || ''),
        draft: data.draft === true,
        featured: data.featured === true,
        description: String(data.description || ''),
        hasSource: sources.some((item) => /^https?:\/\//i.test(String(item?.url || ''))),
        hasHero: Boolean(data.heroImage),
        heroAlt: data.heroAlt ? String(data.heroAlt) : '',
        publishedAt: iso(data.publishedAt),
        updatedAt: data.updatedAt instanceof Date ? data.updatedAt.toISOString() : String(data.updatedAt || ''),
      });
    }
  }
  rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return rows;
}

function readArticle(id) {
  const file = articleFile(id);
  if (!file || !existsSync(file)) return null;
  const { data, body } = splitFrontmatter(readFileSync(file, 'utf8'));
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const summary = Array.isArray(data.summary) ? data.summary.map(String) : [];
  return {
    id,
    title: String(data.title || ''),
    description: String(data.description || ''),
    type: String(data.type || id.split('/')[0]),
    category: String(data.category || ''),
    author: String(data.author || ''),
    publishedAt: iso(data.publishedAt),
    updatedAt: iso(data.updatedAt),
    summary,
    sources: sources.map((item) => ({ name: String(item?.name || ''), url: String(item?.url || '') })),
    featured: data.featured === true,
    breaking: data.breaking === true,
    sponsored: data.sponsored === true,
    affiliate: data.affiliate === true,
    draft: data.draft === true,
    heroAlt: data.heroAlt ? String(data.heroAlt) : '',
    heroImage: data.heroImage ? String(data.heroImage) : '',
    hasHero: Boolean(data.heroImage),
    body,
  };
}

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value || '');
}

function articleErrors(input, body) {
  const errors = [];
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  if (title.length < 12 || title.length > 100) errors.push(`Başlık 12–100 karakter olmalı. Şu an ${title.length}.`);
  if (description.length < 40 || description.length > 180) errors.push(`Açıklama 40–180 karakter olmalı. Şu an ${description.length}.`);
  if (!categories.includes(input.category)) errors.push('Kategori geçersiz.');
  const authors = JSON.parse(readFileSync(dataPath('authors.json'), 'utf8')).map((item) => item.slug);
  if (!authors.includes(input.author)) errors.push('Yazar kadroda yok.');
  const lowered = title.toLocaleLowerCase('tr-TR');
  for (const word of clickbait) {
    if (lowered.includes(word)) errors.push(`Başlıkta abartı var: ${word}.`);
  }
  const summary = Array.isArray(input.summary) ? input.summary.map((item) => String(item).trim()).filter(Boolean) : [];
  if (summary.length < 1 || summary.length > 6) errors.push('Özet 1–6 satır olmalı.');
  if (summary.some((item) => item.length < 10)) errors.push('Her özet satırı en az 10 karakter.');
  const published = Date.parse(input.publishedAt);
  const updated = Date.parse(input.updatedAt);
  if (Number.isNaN(published) || Number.isNaN(updated)) errors.push('Tarih okunamadı.');
  else if (updated < published) errors.push('Güncelleme, yayından önce olamaz.');
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const hasUrl = sources.some((item) => /^https?:\/\//i.test(String(item?.url || '')));
  if (!hasUrl) {
    const stripped = String(body || '').replace(/100 km/g, '').replace(/10-80%/g, '');
    const invented = stripped.match(/\d+(?:[.,]\d+)?\s*(km|kwh|tl|₺|kw|dk)\b/i);
    if (invented) errors.push(`Kaynak adresi yokken metinde sayı var (${invented[0]}).`);
  }
  const hero = String(input.heroImage || '').trim();
  if (hero && !/^\/medya\/[a-z0-9]+\.(jpg|png|webp|avif)$/.test(hero)) errors.push('Görsel yolu /medya/ dosyası olmalı.');
  if (hero && String(input.heroAlt || '').trim().length < 8) errors.push('Görsel varken alternatif metin en az 8 karakter.');
  for (const source of sources) {
    const url = String(source?.url || '').trim();
    if (url && !/^https?:\/\//i.test(url)) errors.push('Kaynak adresi http ile başlamalı.');
    if (!String(source?.name || '').trim()) errors.push('Kaynak adı boş olamaz.');
  }
  return errors;
}

function writeArticle(id, input) {
  const file = articleFile(id);
  if (!file) throw new Error('Yazı adresi geçersiz.');
  const existing = existsSync(file) ? splitFrontmatter(readFileSync(file, 'utf8')).data : {};
  const summary = input.summary.map((item) => String(item).trim()).filter(Boolean);
  const sources = input.sources
    .map((item) => ({
      name: String(item.name || '').trim(),
      ...(String(item.url || '').trim() ? { url: String(item.url).trim() } : {}),
    }))
    .filter((item) => item.name);
  const data = {
    ...existing,
    title: String(input.title).trim(),
    description: String(input.description).trim(),
    type: id.startsWith('haber/') ? 'haber' : 'rehber',
    category: input.category,
    author: input.author,
    publishedAt: input.publishedAt,
    updatedAt: input.updatedAt,
    summary,
    sources,
    featured: Boolean(input.featured),
    breaking: Boolean(input.breaking),
    sponsored: Boolean(input.sponsored),
    affiliate: Boolean(input.affiliate),
    draft: Boolean(input.draft),
    heroImage: String(input.heroImage || '').trim(),
    heroAlt: String(input.heroAlt || '').trim(),
  };
  if (!data.heroImage) delete data.heroImage;
  if (!data.heroAlt) delete data.heroAlt;
  mkdirSync(join(file, '..'), { recursive: true });
  const body = String(input.body || '').replace(/\r\n/g, '\n').trim();
  writeFileSync(file, `---\n${stringify(data)}---\n\n${body}\n`, 'utf8');
  if (data.featured) clearOtherFeatured(id);
}

function clearOtherFeatured(keep) {
  for (const row of listArticles()) {
    if (row.id === keep || !row.featured) continue;
    const file = articleFile(row.id);
    const parsed = splitFrontmatter(readFileSync(file, 'utf8'));
    parsed.data.featured = false;
    writeFileSync(file, `---\n${stringify(parsed.data)}---\n\n${parsed.body.trim()}\n`, 'utf8');
  }
}

function numberOrNull(value) {
  if (value === null || value === '' || value === undefined) return null;
  const number = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(number) || number < 0) return 'invalid';
  return number;
}

function validateCars(rows) {
  const errors = [];
  const slugs = new Set();
  for (const row of rows) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug || '') || String(row.slug).includes('-vs-')) {
      errors.push(`${row.slug || row.name}: slug geçersiz.`);
    }
    if (slugs.has(row.slug)) errors.push(`Yinelenen araç: ${row.slug}`);
    slugs.add(row.slug);
    const numbers = ['priceTry', 'rangeKm', 'batteryKwh', 'dcKw', 'charge10to80Min'].map((key) => numberOrNull(row[key]));
    if (numbers.includes('invalid')) errors.push(`${row.slug}: sayı sıfır veya daha büyük olmalı.`);
    const any = numbers.some((item) => typeof item === 'number');
    if (any && !/^https?:\/\//i.test(row.source?.url || '')) errors.push(`${row.slug}: sayı varken kaynak adresi zorunlu.`);
    if (any && !row.updatedAt) errors.push(`${row.slug}: sayı varken güncelleme tarihi zorunlu.`);
  }
  return errors;
}

function validateTariffs(data) {
  const errors = [];
  for (const row of data.items || []) {
    const price = numberOrNull(row.pricePerKwhTry);
    if (price === 'invalid') errors.push(`${row.name}: kWh fiyatı geçersiz.`);
    if (typeof price === 'number' && !/^https?:\/\//i.test(data.source?.url || row.source?.url || '')) {
      errors.push(`${row.name}: fiyat varken kaynak adresi zorunlu.`);
    }
  }
  for (const row of data.fuels || []) {
    const price = numberOrNull(row.pricePerLitreTry);
    if (price === 'invalid') errors.push(`${row.name}: litre fiyatı geçersiz.`);
    if (typeof price === 'number' && !/^https?:\/\//i.test(row.source?.url || '')) {
      errors.push(`${row.name}: fiyat varken kaynak adresi zorunlu.`);
    }
  }
  return errors;
}

function readJson(name) {
  return JSON.parse(readFileSync(dataPath(name), 'utf8'));
}

function writeJson(name, value) {
  writeFileSync(dataPath(name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function redirectLoop(rows, from, to) {
  const map = new Map(rows.filter((row) => row.from !== from).map((row) => [row.from, row.to]));
  map.set(from, to);
  let cursor = to;
  const seen = new Set([from]);
  while (map.has(cursor)) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = map.get(cursor);
  }
  return false;
}

function mediaDir() {
  return join(root, 'public', 'medya');
}

export function imageKind(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'avif';
  }
  return '';
}

function mediaUsage() {
  const used = new Map();
  for (const folder of ['haber', 'rehber']) {
    const dir = join(contentRoot(), folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const text = readFileSync(join(dir, file), 'utf8');
      const id = `${folder}/${file.slice(0, -3)}`;
      for (const match of text.matchAll(/\/medya\/[a-z0-9]+\.(?:jpg|png|webp|avif)/g)) {
        const list = used.get(match[0]) || [];
        if (!list.includes(id)) list.push(id);
        used.set(match[0], list);
      }
    }
  }
  return used;
}

function listMedia() {
  const dir = mediaDir();
  if (!existsSync(dir)) return [];
  const used = mediaUsage();
  return readdirSync(dir)
    .filter((name) => /^[a-z0-9]+\.(jpg|png|webp|avif)$/.test(name))
    .map((name) => {
      const path = `/medya/${name}`;
      return { name, path, bytes: statSync(join(dir, name)).size, articles: used.get(path) || [] };
    });
}

function cleanLink(link) {
  return { href: String(link.href || '').trim(), label: String(link.label || '').trim() };
}

function linkError(link, where) {
  const href = String(link?.href || '').trim();
  const label = String(link?.label || '').trim();
  if (label.length < 2 || label.length > 40) return `${where}: etiket 2–40 karakter olmalı.`;
  const internal = href === '/' || (href.startsWith('/') && !href.startsWith('//') && !href.endsWith('/') && !/\s/.test(href));
  const external = /^https:\/\/[^\s]+$/.test(href);
  if (!internal && !external) return `${where}: adres /yol veya https ile başlamalı.`;
  return '';
}

function validateNavigation(body) {
  const errors = [];
  if (!Array.isArray(body?.header) || body.header.length < 1 || body.header.length > 8) errors.push('Üst menü 1–8 bağlantı olmalı.');
  else body.header.forEach((link, index) => {
    const error = linkError(link, `Üst menü ${index + 1}`);
    if (error) errors.push(error);
  });
  if (!Array.isArray(body?.footer) || body.footer.length < 1 || body.footer.length > 4) errors.push('Footer 1–4 sütun olmalı.');
  else body.footer.forEach((column, index) => {
    const title = String(column?.title || '').trim();
    if (title.length < 2 || title.length > 24) errors.push(`Sütun ${index + 1}: başlık 2–24 karakter.`);
    if (!Array.isArray(column?.links) || column.links.length < 1 || column.links.length > 12) errors.push(`${title || index + 1}: 1–12 bağlantı olmalı.`);
    else column.links.forEach((link, linkIndex) => {
      const error = linkError(link, `${title} ${linkIndex + 1}`);
      if (error) errors.push(error);
    });
  });
  return errors;
}

function knownPaths() {
  const paths = new Set([
    '/', '/haber', '/rehber', '/karsilastir', '/arac', '/arac/hesaplayici', '/arac/rota', '/arac/yakit',
    '/yazar', '/ara', '/hakkimizda', '/iletisim', '/kunye', '/yayin-ilkeleri', '/duzeltme-politikasi',
    '/gizlilik', '/cerez-politikasi', '/kvkk', '/reklam-politikasi', '/rss.xml', '/sitemap-index.xml',
  ]);
  for (const slug of categories) paths.add(`/kategori/${slug}`);
  for (const row of listArticles()) {
    if (!row.draft) paths.add(`/${row.id}`);
  }
  for (const author of readJson('authors.json')) paths.add(`/yazar/${author.slug}`);
  const cars = readJson('cars.json').map((row) => row.slug).filter(Boolean).sort((a, b) => a.localeCompare(b, 'tr'));
  for (let left = 0; left < cars.length; left += 1) {
    for (let right = left + 1; right < cars.length; right += 1) paths.add(`/karsilastir/${cars[left]}-vs-${cars[right]}`);
  }
  return paths;
}

function seoReport() {
  const articles = listArticles();
  const titles = new Map();
  for (const row of articles) {
    const key = row.title.trim().toLocaleLowerCase('tr-TR');
    const list = titles.get(key) || [];
    list.push(row.id);
    titles.set(key, list);
  }
  const duplicates = [...titles.entries()].filter(([, ids]) => ids.length > 1).map(([title, ids]) => ({ title, ids }));
  const meta = articles.filter((row) => {
    const length = String(row.description || '').trim().length;
    return length < 40 || length > 180;
  }).map((row) => ({ id: row.id, title: row.title, length: String(row.description || '').trim().length }));
  const ideal = articles.filter((row) => {
    const length = String(row.description || '').trim().length;
    return length >= 40 && length <= 180 && (length < 120 || length > 160);
  }).map((row) => ({ id: row.id, title: row.title, length: String(row.description || '').trim().length }));
  const paths = knownPaths();
  const missingLinks = [];
  for (const folder of ['haber', 'rehber']) {
    const dir = join(contentRoot(), folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const id = `${folder}/${file.slice(0, -3)}`;
      const text = readFileSync(join(dir, file), 'utf8');
      for (const match of text.matchAll(/\]\((\/[^)\s]*)\)/g)) {
        const path = match[1].split(/[?#]/)[0].replace(/\/$/, '') || '/';
        if (!paths.has(path)) missingLinks.push({ id, path });
      }
    }
  }
  const origin = String(process.env.PUBLIC_SITE_URL || 'http://localhost:4321').replace(/\/$/, '');
  return {
    origin,
    robots: 'Allow: / ve Disallow: /admin. Aynı blok *, GPTBot, Google-Extended, PerplexityBot, ClaudeBot ve Applebot-Extended için üretilir. Tam metin /robots.txt adresindedir. Panel bu dosyayı değiştirmez.',
    sitemap: 'Site haritası derlemede üretilir. Bu ekran dosyayı yeniden yazmaz.',
    published: articles.filter((row) => !row.draft).length,
    meta,
    ideal,
    duplicates,
    missingLinks,
    noSource: articles.filter((row) => !row.hasSource).map((row) => ({ id: row.id, title: row.title })),
  };
}

function logActivity(action, target) {
  const rows = existsSync(dataPath('activity.json')) ? readJson('activity.json') : [];
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const next = [{ at: new Date().toISOString(), action: String(action), target: String(target || '') }, ...rows]
    .filter((row) => Date.parse(row.at) >= cutoff)
    .slice(0, 200);
  writeJson('activity.json', next);
}

function buildBackup() {
  const articles = [];
  for (const folder of ['haber', 'rehber']) {
    const dir = join(contentRoot(), folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      articles.push({ id: `${folder}/${file.slice(0, -3)}`, markdown: readFileSync(join(dir, file), 'utf8') });
    }
  }
  return {
    exportedAt: new Date().toISOString(),
    articles,
    tariffs: readJson('tariffs.json'),
    cars: readJson('cars.json'),
    authors: readJson('authors.json'),
    redirects: readJson('redirects.json'),
    faq: readJson('faq.json'),
    settings: readJson('settings.json'),
    navigation: readJson('navigation.json'),
    media: listMedia().map((item) => item.path),
  };
}

function readRaw(req, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Dosya 5 MB sınırını aşıyor.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function pageFileExists(name) {
  return existsSync(join(root, 'src', 'pages', name));
}

function overview() {
  const articles = listArticles();
  const tariffs = readJson('tariffs.json');
  const cars = readJson('cars.json');
  const settings = readJson('settings.json');
  const publisher = String(settings.adsensePublisherId || process.env.PUBLIC_ADSENSE_PUBLISHER_ID || '').trim();
  const adsTxt = /^pub-\d+$/.test(publisher);
  const metaMissing = articles.filter((item) => {
    const length = String(item.description || '').trim().length;
    return length < 40 || length > 180;
  }).length;
  const pagesReady = pageFileExists('hakkimizda.astro') && pageFileExists('iletisim.astro');
  const legalReady = pageFileExists('gizlilik.astro') && pageFileExists('cerez-politikasi.astro') && pageFileExists('kvkk.astro');
  const checks = [
    { id: 'pages', label: 'Hakkımızda ve İletişim sayfaları', ok: pagesReady, manual: false },
    { id: 'legal', label: 'Gizlilik, çerez ve KVKK metinleri', ok: legalReady, manual: false },
    { id: 'articles', label: `En az 20 özgün yazı (şu an ${articles.length})`, ok: articles.length >= 20, manual: false },
    { id: 'ads', label: 'ads.txt geçerli yayıncı satırı içeriyor', ok: adsTxt, manual: false },
    { id: 'speed', label: 'Mobil uyum ve sayfa hızı', ok: false, manual: true },
  ];
  return {
    articles: articles.length,
    drafts: articles.filter((item) => item.draft).length,
    cars: cars.length,
    tariffs: tariffs.items.length,
    fuels: tariffs.fuels?.length || 0,
    authors: readJson('authors.json').length,
    redirects: readJson('redirects.json').length,
    faqs: readJson('faq.json').length,
    pages: pageCatalog.filter((item) => pageFileExists(item.file)).length,
    media: listMedia().length,
    categories: categories.length,
    metaMissing,
    adsTxt,
    checks,
    recent: articles.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      draft: item.draft,
    })),
    scheduled: articles
      .filter((item) => !item.draft && Date.parse(item.publishedAt) > Date.now())
      .slice(0, 5)
      .map((item) => ({ id: item.id, title: item.title, publishedAt: item.publishedAt })),
    activity: (existsSync(dataPath('activity.json')) ? readJson('activity.json') : []).slice(0, 5),
    search: [
      ...articles.map((item) => ({
        title: item.title || item.id,
        href: `/admin/yazilar?id=${encodeURIComponent(item.id)}`,
      })),
      ...cars.map((car) => ({
        title: String(car.name || car.slug || 'Araç'),
        href: '/admin/araclar',
      })),
    ],
    siteUrl: process.env.PUBLIC_SITE_URL || '',
    contactSet: Boolean(process.env.PUBLIC_CONTACT_EMAIL),
    adsenseSet: adsTxt,
    analyticsSet: ['ga4', 'plausible'].includes(String(settings.analytics || process.env.PUBLIC_ANALYTICS || '')),
    newsletterSet: Boolean(process.env.PUBLIC_NEWSLETTER_ENDPOINT),
    passwordSet: Boolean(password()),
  };
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return req.headers['x-benzinsiz-admin'] === '1';
  try {
    return new URL(origin).host === req.headers.host && req.headers['x-benzinsiz-admin'] === '1';
  } catch {
    return false;
  }
}

export async function handleAdmin(req, res) {
  const url = new URL(req.url || '/', 'http://local');
  const path = url.pathname;
  const writing = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
  if (writing && !sameOrigin(req)) {
    send(res, 403, { error: 'İstek kaynağı kabul edilmedi.' });
    return;
  }
  if (!password() && path !== '/api/admin/session') {
    send(res, 503, { error: 'ADMIN_PASSWORD boş. .env içine yazıp sunucuyu yeniden başlat.' });
    return;
  }
  if (req.method === 'POST' && path === '/api/admin/login') {
    if (limited(req)) {
      send(res, 429, { error: 'Çok fazla deneme. 15 dakika sonra yeniden dene.' });
      return;
    }
    const body = await readBody(req);
    if (!safeEqual(String(body.password || ''), password())) {
      noteFailure(req);
      send(res, 401, { error: 'Şifre yanlış.' });
      return;
    }
    attempts.delete(clientKey(req));
    logActivity('oturum', 'giris');
    const exp = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = `${exp}.${sign(exp)}`;
    send(res, 200, { ok: true }, {
      'set-cookie': `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
    });
    return;
  }
  if (req.method === 'POST' && path === '/api/admin/logout') {
    if (sessionOk(req)) logActivity('oturum', 'cikis');
    send(res, 200, { ok: true }, {
      'set-cookie': `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    });
    return;
  }
  if (req.method === 'GET' && path === '/api/admin/session') {
    send(res, 200, { ok: sessionOk(req), configured: Boolean(password()) });
    return;
  }
  if (!sessionOk(req)) {
    send(res, 401, { error: 'Giriş gerekli.' });
    return;
  }
  if (req.method === 'GET' && path === '/api/admin/overview') {
    send(res, 200, overview());
    return;
  }
  if (req.method === 'GET' && path === '/api/admin/articles') {
    const id = url.searchParams.get('id');
    if (id) {
      const article = readArticle(id);
      if (!article) return send(res, 404, { error: 'Yazı yok.' });
      return send(res, 200, article);
    }
    return send(res, 200, { articles: listArticles(), categories, authors: readJson('authors.json') });
  }
  if ((req.method === 'POST' || req.method === 'PUT') && path === '/api/admin/articles') {
    const body = await readBody(req);
    const id = String(body.id || '');
    const file = articleFile(id);
    if (!file) return send(res, 400, { error: 'Adres haber/slug veya rehber/slug biçiminde olmalı.' });
    if (req.method === 'POST' && existsSync(file)) return send(res, 409, { error: 'Bu adres dolu.' });
    if (req.method === 'PUT' && !existsSync(file)) return send(res, 404, { error: 'Yazı yok.' });
    if (body.patch === true) {
      const current = readArticle(id);
      if (!current) return send(res, 404, { error: 'Yazı yok.' });
      body.title = current.title;
      body.description = current.description;
      body.author = current.author;
      body.publishedAt = current.publishedAt;
      body.updatedAt = current.updatedAt;
      body.summary = current.summary;
      body.sources = current.sources;
      body.body = current.body;
      body.featured = current.featured;
      body.breaking = current.breaking;
      body.sponsored = current.sponsored;
      body.affiliate = current.affiliate;
      body.heroImage = current.heroImage;
      body.heroAlt = current.heroAlt;
      if (body.draft === undefined) body.draft = current.draft;
      if (!body.category) body.category = current.category;
    }
    const errors = articleErrors(body, body.body);
    if (errors.length) return send(res, 400, { errors });
    const nextId = String(body.nextId || '');
    if (nextId && nextId !== id) {
      if (req.method !== 'PUT') return send(res, 400, { error: 'Yeni yazıda adresi kayıttan önce seç.' });
      const nextFile = articleFile(nextId);
      if (!nextFile) return send(res, 400, { error: 'Yeni adres geçersiz.' });
      if (existsSync(nextFile)) return send(res, 409, { error: 'Yeni adres dolu.' });
      const from = `/${id}`;
      const to = `/${nextId}`;
      const redirects = readJson('redirects.json');
      if (redirectLoop(redirects, from, to)) return send(res, 400, { error: 'Bu yönlendirme döngü kuruyor.' });
      writeArticle(nextId, body);
      unlinkSync(file);
      const next = redirects.filter((row) => row.from !== from);
      next.push({ from, to });
      writeJson('redirects.json', next);
      logActivity('yazi', `${id} → ${nextId}`);
      return send(res, 200, { ok: true, id: nextId, redirect: { from, to } });
    }
    writeArticle(id, body);
    logActivity(body.patch === true ? 'yazi-durum' : 'yazi', id);
    return send(res, 200, { ok: true, id });
  }
  if (req.method === 'DELETE' && path === '/api/admin/articles') {
    const id = url.searchParams.get('id') || '';
    const file = articleFile(id);
    if (!file || !existsSync(file)) return send(res, 404, { error: 'Yazı yok.' });
    unlinkSync(file);
    logActivity('yazi-sil', id);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/tariffs') {
    const tariffs = readJson('tariffs.json');
    tariffs.history = existsSync(dataPath('tariff-history.json')) ? readJson('tariff-history.json') : [];
    return send(res, 200, tariffs);
  }
  if (req.method === 'PUT' && path === '/api/admin/tariffs') {
    const body = await readBody(req);
    const errors = validateTariffs(body);
    if (errors.length) return send(res, 400, { errors });
    for (const row of [...(body.items || []), ...(body.fuels || [])]) {
      if (row.pricePerKwhTry !== undefined) row.pricePerKwhTry = numberOrNull(row.pricePerKwhTry);
      if (row.pricePerLitreTry !== undefined) row.pricePerLitreTry = numberOrNull(row.pricePerLitreTry);
    }
    writeJson('tariffs.json', body);
    const history = existsSync(dataPath('tariff-history.json')) ? readJson('tariff-history.json') : [];
    history.unshift({
      at: new Date().toISOString(),
      updatedAt: String(body.updatedAt || ''),
      items: (body.items || []).map((row) => ({ id: row.id, pricePerKwhTry: row.pricePerKwhTry })),
      fuels: (body.fuels || []).map((row) => ({ id: row.id, pricePerLitreTry: row.pricePerLitreTry })),
    });
    writeJson('tariff-history.json', history.slice(0, 8));
    logActivity('tarife', 'tariffs.json');
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/cars') return send(res, 200, readJson('cars.json'));
  if (req.method === 'PUT' && path === '/api/admin/cars') {
    const body = await readBody(req);
    if (!Array.isArray(body)) return send(res, 400, { error: 'Araç listesi bekleniyor.' });
    const errors = validateCars(body);
    if (errors.length) return send(res, 400, { errors });
    const clean = body.map((row) => ({
      ...row,
      id: row.slug,
      priceTry: numberOrNull(row.priceTry),
      rangeKm: numberOrNull(row.rangeKm),
      batteryKwh: numberOrNull(row.batteryKwh),
      dcKw: numberOrNull(row.dcKw),
      charge10to80Min: numberOrNull(row.charge10to80Min),
      warranty: row.warranty || null,
      source: { name: row.source?.name || null, url: row.source?.url || null },
      updatedAt: row.updatedAt || null,
    }));
    writeJson('cars.json', clean);
    logActivity('arac', `${clean.length} kayıt`);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/authors') return send(res, 200, readJson('authors.json'));
  if (req.method === 'PUT' && path === '/api/admin/authors') {
    const body = await readBody(req);
    if (!Array.isArray(body) || body.length === 0) return send(res, 400, { error: 'En az bir görev kalmalı.' });
    const used = new Set(listArticles().map((item) => readArticle(item.id)?.author).filter(Boolean));
    const slugs = new Set(body.map((item) => item.slug));
    for (const slug of used) {
      if (!slugs.has(slug)) return send(res, 400, { error: `${slug} yazılarda geçiyor. Silinemez.` });
    }
    for (const row of body) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug || '')) return send(res, 400, { error: 'Yazar adresi geçersiz.' });
      if (!row.name || !row.jobTitle || !row.duty || !row.bio) return send(res, 400, { error: `${row.slug}: ad, görev, sorumluluk ve tanıtım dolu olmalı.` });
      row.expertise = Array.isArray(row.expertise) ? row.expertise.map((item) => String(item).trim()).filter(Boolean) : [];
    }
    writeJson('authors.json', body);
    logActivity('kadro', `${body.length} kayıt`);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/redirects') return send(res, 200, readJson('redirects.json'));
  if (req.method === 'PUT' && path === '/api/admin/redirects') {
    const body = await readBody(req);
    if (!Array.isArray(body)) return send(res, 400, { error: 'Liste bekleniyor.' });
    const seen = new Set();
    for (const row of body) {
      row.from = String(row.from || '').trim();
      row.to = String(row.to || '').trim();
      if (!row.from.startsWith('/') || !row.to.startsWith('/') || row.from.endsWith('/') || row.to.endsWith('/')) {
        return send(res, 400, { error: 'Yönlendirme / ile başlamalı ve / ile bitmemeli.' });
      }
      if (row.from === row.to) return send(res, 400, { error: 'Yönlendirme kendine dönüyor.' });
      if (seen.has(row.from)) return send(res, 400, { error: `${row.from} birden fazla satırda.` });
      seen.add(row.from);
      if (redirectLoop(body, row.from, row.to)) return send(res, 400, { error: `${row.from} döngü kuruyor.` });
    }
    writeJson('redirects.json', body.map((row) => ({ from: row.from, to: row.to })));
    logActivity('yonlendirme', `${body.length} kayıt`);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/faq') return send(res, 200, readJson('faq.json'));
  if (req.method === 'PUT' && path === '/api/admin/faq') {
    const body = await readBody(req);
    if (!Array.isArray(body) || body.length === 0) return send(res, 400, { error: 'En az bir soru kalmalı.' });
    for (const row of body) {
      if (String(row.question || '').trim().length < 8) return send(res, 400, { error: 'Soru en az 8 karakter.' });
      if (String(row.answer || '').trim().length < 20) return send(res, 400, { error: 'Yanıt en az 20 karakter.' });
    }
    writeJson('faq.json', body.map((row) => ({ question: String(row.question).trim(), answer: String(row.answer).trim() })));
    logActivity('soru', `${body.length} kayıt`);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/categories') {
    const settings = readJson('settings.json');
    const counts = {};
    for (const row of listArticles()) counts[row.category] = (counts[row.category] || 0) + 1;
    return send(res, 200, categories.map((slug) => ({
      slug,
      name: categoryNames[slug],
      description: String(settings.categories?.[slug] || ''),
      count: counts[slug] || 0,
    })));
  }
  if (req.method === 'PUT' && path === '/api/admin/categories') {
    const body = await readBody(req);
    if (!categories.includes(body.slug)) return send(res, 400, { error: 'Kategori adresi şemada yok. Yeni adres eklenemez.' });
    const description = String(body.description || '').trim();
    if (description.length < 40 || description.length > 180) {
      return send(res, 400, { error: `Açıklama 40–180 karakter olmalı. Şu an ${description.length}.` });
    }
    const settings = readJson('settings.json');
    settings.categories = { ...settings.categories, [body.slug]: description };
    writeJson('settings.json', settings);
    logActivity('kategori', String(body.slug));
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/pages') {
    const settings = readJson('settings.json');
    return send(res, 200, pageCatalog.map((item) => {
      const description = String(settings.meta?.[item.meta] || '');
      return { ...item, exists: pageFileExists(item.file), description, length: description.trim().length };
    }));
  }
  if (req.method === 'GET' && path === '/api/admin/media') return send(res, 200, listMedia());
  if (req.method === 'POST' && path === '/api/admin/media') {
    let buffer;
    try {
      buffer = await readRaw(req, 5 * 1024 * 1024);
    } catch (error) {
      return send(res, 413, { error: error.message || 'Dosya okunamadı.' });
    }
    const kind = imageKind(buffer);
    if (!kind) return send(res, 400, { error: 'Yalnızca jpg, png, webp veya avif. SVG kabul edilmez.' });
    const name = `${randomBytes(8).toString('hex')}.${kind}`;
    mkdirSync(mediaDir(), { recursive: true });
    writeFileSync(join(mediaDir(), name), buffer);
    logActivity('medya', `/medya/${name}`);
    return send(res, 200, { ok: true, path: `/medya/${name}` });
  }
  if (req.method === 'DELETE' && path === '/api/admin/media') {
    const name = url.searchParams.get('name') || '';
    if (!/^[a-z0-9]+\.(jpg|png|webp|avif)$/.test(name)) return send(res, 400, { error: 'Dosya adı geçersiz.' });
    const file = join(mediaDir(), name);
    if (!existsSync(file)) return send(res, 404, { error: 'Dosya yok.' });
    const articles = mediaUsage().get(`/medya/${name}`) || [];
    if (articles.length) return send(res, 409, { error: `Dosya yazıda geçiyor: ${articles.join(', ')}` });
    unlinkSync(file);
    logActivity('medya-sil', name);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/navigation') return send(res, 200, readJson('navigation.json'));
  if (req.method === 'PUT' && path === '/api/admin/navigation') {
    const body = await readBody(req);
    const errors = validateNavigation(body);
    if (errors.length) return send(res, 400, { errors });
    writeJson('navigation.json', {
      header: body.header.map(cleanLink),
      footer: body.footer.map((column) => ({
        title: String(column.title).trim(),
        links: column.links.map(cleanLink),
      })),
    });
    logActivity('menu', 'navigation.json');
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/seo') return send(res, 200, seoReport());
  if (req.method === 'GET' && path === '/api/admin/activity') {
    const rows = existsSync(dataPath('activity.json')) ? readJson('activity.json') : [];
    return send(res, 200, { rows, actor: 'Yönetici' });
  }
  if (req.method === 'GET' && path === '/api/admin/backup') {
    const payload = buildBackup();
    logActivity('yedek', `${payload.articles.length} yazı`);
    return send(res, 200, payload);
  }
  if (req.method === 'GET' && path === '/api/admin/account') {
    return send(res, 200, {
      role: 'Yönetici',
      others: false,
      sessionDays: 7,
      passwordInForm: false,
    });
  }
  if (req.method === 'GET' && path === '/api/admin/settings') {
    return send(res, 200, { settings: readJson('settings.json'), env: settingsEnv() });
  }
  if (req.method === 'PUT' && path === '/api/admin/settings') {
    const body = await readBody(req);
    const { errors, value } = validateSettings(body);
    if (errors.length) return send(res, 400, { errors });
    writeJson('settings.json', value);
    logActivity('ayar', 'settings.json');
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Adres yok.' });
}

const metaLabels = {
  home: 'Ana sayfa',
  haber: 'Haberler',
  rehber: 'Rehberler',
  karsilastir: 'Karşılaştırma',
  arac: 'Araçlar',
  hesaplayici: 'Şarj hesaplayıcı',
  rota: 'Rota planlayıcı',
  yakit: 'Yakıt gideri',
  yazarlar: 'Kadrolar',
  arama: 'Arama',
  bulunamadi: 'Sayfa yok',
  hakkimizda: 'Hakkımızda',
  kunye: 'Künye',
  ilkeler: 'Yayın ilkeleri',
  duzeltme: 'Düzeltme',
  reklam: 'Reklam',
  gizlilik: 'Gizlilik',
  kvkk: 'KVKK',
  cerez: 'Çerez',
  iletisim: 'İletişim',
};

function settingsEnv() {
  return {
    siteUrl: process.env.PUBLIC_SITE_URL || '',
    contactEmail: process.env.PUBLIC_CONTACT_EMAIL || '',
    contactEndpoint: process.env.PUBLIC_CONTACT_ENDPOINT || '',
    analytics: process.env.PUBLIC_ANALYTICS || '',
    plausibleDomain: process.env.PUBLIC_PLAUSIBLE_DOMAIN || '',
    plausibleSrc: process.env.PUBLIC_PLAUSIBLE_SRC || '',
    ga4Id: process.env.PUBLIC_GA4_ID || '',
    cmpScriptUrl: process.env.PUBLIC_CMP_SCRIPT_URL || '',
    newsletterEndpoint: process.env.PUBLIC_NEWSLETTER_ENDPOINT || '',
    newsletterFormat: process.env.PUBLIC_NEWSLETTER_FORMAT || '',
    adsensePublisherId: process.env.PUBLIC_ADSENSE_PUBLISHER_ID || '',
    adSlots: {
      homeTop: process.env.PUBLIC_ADSENSE_SLOT_HOME_TOP || '',
      homeMid: process.env.PUBLIC_ADSENSE_SLOT_HOME_MID || '',
      early: process.env.PUBLIC_ADSENSE_SLOT_ARTICLE_EARLY || '',
      mid: process.env.PUBLIC_ADSENSE_SLOT_ARTICLE_MID || '',
      late: process.env.PUBLIC_ADSENSE_SLOT_ARTICLE_LATE || '',
      sidebar: process.env.PUBLIC_ADSENSE_SLOT_SIDEBAR || '',
    },
  };
}

function validateSettings(body) {
  const errors = [];
  const text = (value) => String(value || '').trim();
  const siteName = text(body.siteName);
  const slogan = text(body.slogan);
  if (siteName.length < 2 || siteName.length > 40) errors.push('Yayın adı 2–40 karakter olmalı.');
  if (slogan.length < 8 || slogan.length > 120) errors.push('Slogan 8–120 karakter olmalı.');
  const siteUrl = text(body.siteUrl).replace(/\/$/, '');
  if (siteUrl && !/^https?:\/\//i.test(siteUrl)) errors.push('Site adresi http ile başlamalı.');
  const contactEmail = text(body.contactEmail);
  if (contactEmail && (contactEmail.endsWith('.example') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) {
    errors.push('İletişim e-postası geçersiz. Örnek adres yazma.');
  }
  const contactEndpoint = text(body.contactEndpoint);
  if (contactEndpoint && !/^https?:\/\//i.test(contactEndpoint)) errors.push('İletişim servisi http ile başlamalı.');
  const analytics = text(body.analytics);
  if (analytics && analytics !== 'plausible' && analytics !== 'ga4') errors.push('Ölçüm boş, Plausible veya GA4 olmalı.');
  const plausibleDomain = text(body.plausibleDomain);
  if (plausibleDomain && /[\s/]/.test(plausibleDomain)) errors.push('Plausible alanına yalnızca alan adı yaz.');
  const plausibleSrc = text(body.plausibleSrc);
  if (plausibleSrc && !/^https:\/\//i.test(plausibleSrc)) errors.push('Plausible betiği https ile başlamalı.');
  const ga4Id = text(body.ga4Id);
  if (ga4Id && !/^G-[A-Z0-9]+$/.test(ga4Id)) errors.push('GA4 kimliği G- ile başlamalı.');
  const cmpScriptUrl = text(body.cmpScriptUrl);
  if (cmpScriptUrl && !/^https:\/\//i.test(cmpScriptUrl)) errors.push('CMP adresi https ile başlamalı.');
  const newsletterEndpoint = text(body.newsletterEndpoint);
  if (newsletterEndpoint && !/^https?:\/\//i.test(newsletterEndpoint)) errors.push('Bülten adresi http ile başlamalı.');
  const newsletterFormat = text(body.newsletterFormat);
  if (newsletterFormat && newsletterFormat !== 'json' && newsletterFormat !== 'form') errors.push('Bülten biçimi json veya form olmalı.');
  const adsensePublisherId = text(body.adsensePublisherId);
  if (adsensePublisherId && !/^pub-\d+$/.test(adsensePublisherId)) errors.push('AdSense kimliği pub- ve rakam olmalı.');
  const slotNames = {
    homeTop: 'Ana sayfa üst',
    homeMid: 'Ana sayfa orta',
    early: 'Yazı başı',
    mid: 'Yazı ortası',
    late: 'Yazı sonu',
    sidebar: 'Kenar',
  };
  const adSlots = {};
  for (const key of Object.keys(slotNames)) {
    const slot = text(body.adSlots?.[key]);
    if (slot && !/^\d{6,12}$/.test(slot)) errors.push(`${slotNames[key]} reklam alanı 6–12 rakam olmalı.`);
    adSlots[key] = slot;
  }
  const meta = {};
  for (const key of Object.keys(metaLabels)) {
    const copy = text(body.meta?.[key]);
    if (copy.length < 40 || copy.length > 180) errors.push(`${metaLabels[key]} açıklaması 40–180 karakter olmalı. Şu an ${copy.length}.`);
    meta[key] = copy;
  }
  const categoryNames = {
    sarj: 'Şarj',
    menzil: 'Menzil',
    maliyet: 'Maliyet',
    alim: 'Satın alma',
    modeller: 'Modeller',
    mevzuat: 'Mevzuat',
    inceleme: 'İncelemeler',
    bakim: 'Bakım',
  };
  const categoryCopy = {};
  for (const key of categories) {
    const copy = text(body.categories?.[key]);
    if (copy.length < 40 || copy.length > 180) errors.push(`${categoryNames[key]} açıklaması 40–180 karakter olmalı. Şu an ${copy.length}.`);
    categoryCopy[key] = copy;
  }
  return {
    errors,
    value: {
      siteName,
      slogan,
      siteUrl,
      contactEmail,
      contactEndpoint,
      analytics,
      plausibleDomain,
      plausibleSrc,
      ga4Id,
      cmpScriptUrl,
      newsletterEndpoint,
      newsletterFormat,
      adsensePublisherId,
      adSlots,
      meta,
      categories: categoryCopy,
    },
  };
}
