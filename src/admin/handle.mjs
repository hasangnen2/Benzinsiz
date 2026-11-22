import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const cookieName = 'benzinsiz_admin';
const categories = ['sarj', 'menzil', 'maliyet', 'alim', 'modeller', 'mevzuat', 'inceleme', 'bakim'];
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
      rows.push({
        id,
        title: String(data.title || ''),
        type: String(data.type || folder),
        category: String(data.category || ''),
        draft: data.draft === true,
        featured: data.featured === true,
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

function overview() {
  const articles = listArticles();
  const tariffs = readJson('tariffs.json');
  const cars = readJson('cars.json');
  return {
    articles: articles.length,
    drafts: articles.filter((item) => item.draft).length,
    cars: cars.length,
    tariffs: tariffs.items.length,
    fuels: tariffs.fuels?.length || 0,
    authors: readJson('authors.json').length,
    redirects: readJson('redirects.json').length,
    faqs: readJson('faq.json').length,
    recent: articles.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      draft: item.draft,
    })),
    siteUrl: process.env.PUBLIC_SITE_URL || '',
    contactSet: Boolean(process.env.PUBLIC_CONTACT_EMAIL),
    adsenseSet: Boolean(process.env.PUBLIC_ADSENSE_PUBLISHER_ID),
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
    const exp = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = `${exp}.${sign(exp)}`;
    send(res, 200, { ok: true }, {
      'set-cookie': `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
    });
    return;
  }
  if (req.method === 'POST' && path === '/api/admin/logout') {
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
    const errors = articleErrors(body, body.body);
    if (errors.length) return send(res, 400, { errors });
    writeArticle(id, body);
    return send(res, 200, { ok: true, id });
  }
  if (req.method === 'DELETE' && path === '/api/admin/articles') {
    const id = url.searchParams.get('id') || '';
    const file = articleFile(id);
    if (!file || !existsSync(file)) return send(res, 404, { error: 'Yazı yok.' });
    unlinkSync(file);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/tariffs') return send(res, 200, readJson('tariffs.json'));
  if (req.method === 'PUT' && path === '/api/admin/tariffs') {
    const body = await readBody(req);
    const errors = validateTariffs(body);
    if (errors.length) return send(res, 400, { errors });
    for (const row of [...(body.items || []), ...(body.fuels || [])]) {
      if (row.pricePerKwhTry !== undefined) row.pricePerKwhTry = numberOrNull(row.pricePerKwhTry);
      if (row.pricePerLitreTry !== undefined) row.pricePerLitreTry = numberOrNull(row.pricePerLitreTry);
    }
    writeJson('tariffs.json', body);
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
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/redirects') return send(res, 200, readJson('redirects.json'));
  if (req.method === 'PUT' && path === '/api/admin/redirects') {
    const body = await readBody(req);
    if (!Array.isArray(body)) return send(res, 400, { error: 'Liste bekleniyor.' });
    for (const row of body) {
      if (!row.from?.startsWith('/') || !row.to?.startsWith('/') || row.from.endsWith('/') || row.to.endsWith('/')) {
        return send(res, 400, { error: 'Yönlendirme / ile başlamalı ve / ile bitmemeli.' });
      }
      if (row.from === row.to) return send(res, 400, { error: 'Yönlendirme kendine dönüyor.' });
    }
    writeJson('redirects.json', body);
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
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/admin/settings') {
    return send(res, 200, { settings: readJson('settings.json'), env: settingsEnv() });
  }
  if (req.method === 'PUT' && path === '/api/admin/settings') {
    const body = await readBody(req);
    const { errors, value } = validateSettings(body);
    if (errors.length) return send(res, 400, { errors });
    writeJson('settings.json', value);
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
