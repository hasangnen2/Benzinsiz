const categories = [
  ['sarj', 'Şarj'],
  ['menzil', 'Menzil'],
  ['maliyet', 'Maliyet'],
  ['alim', 'Satın alma'],
  ['modeller', 'Modeller'],
  ['mevzuat', 'Mevzuat'],
  ['inceleme', 'İncelemeler'],
  ['bakim', 'Bakım'],
] as const;

type Json = Record<string, unknown>;

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}

async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') headers.set('x-benzinsiz-admin', '1');
  if (options.body) headers.set('content-type', 'application/json');
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    return { ok: false, status: 0, data: { error: 'Sunucuya ulaşılamadı. npm run dev açık olmalı.' } };
  }
  const data = (await response.json().catch(() => ({ error: 'Kayıt servisi yok. npm run dev açık olmalı.' }))) as Json;
  if (response.status === 401 && !path.endsWith('/login')) location.href = '/admin/giris';
  return { ok: response.ok, status: response.status, data };
}

function errorsOf(data: Json) {
  if (Array.isArray(data.errors)) return data.errors.map(String).join(' ');
  return String(data.error || 'Kayıt olmadı.');
}

function localValue(value: unknown) {
  const text = String(value || '');
  const match = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function withOffset(value: string) {
  if (!value) return '';
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value;
  return `${value}:00+03:00`;
}

function statusBox(host: ParentNode) {
  let box = host.querySelector<HTMLElement>('.admin-status');
  if (!box) {
    box = document.createElement('p');
    box.className = 'admin-status';
    box.hidden = true;
    host.prepend(box);
  }
  return (message: string, error = false) => {
    box.hidden = !message;
    box.textContent = message;
    box.classList.toggle('is-error', error);
  };
}

function field(label: string, name: string, value = '', kind = 'text', placeholder = '') {
  const hold = placeholder ? ` placeholder="${esc(placeholder)}"` : '';
  if (kind === 'textarea') {
    return `<label>${esc(label)}<textarea name="${name}" data-field="${name}"${hold}>${esc(value)}</textarea></label>`;
  }
  return `<label>${esc(label)}<input type="${kind}" name="${name}" data-field="${name}" value="${esc(value)}"${hold} /></label>`;
}

function selectField(label: string, name: string, value: string, options: readonly (readonly [string, string])[]) {
  const opts = options
    .map(([id, text]) => `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(text)}</option>`)
    .join('');
  return `<label>${esc(label)}<select name="${name}" data-field="${name}">${opts}</select></label>`;
}

function money(value: unknown, unit: string) {
  if (value === null || value === undefined || value === '') return 'Fiyat kayıtlı değil';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Fiyat kayıtlı değil';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(number)} ${unit}`;
}

function record(title: string, meta: string, body: string, remove = '') {
  const button = remove ? `<button class="btn btn-danger" type="button" ${remove}>Sil</button>` : '';
  return `<section class="record">
    <div class="record-head">
      <div class="record-copy"><h2>${esc(title)}</h2>${meta ? `<p class="record-meta">${esc(meta)}</p>` : ''}</div>
      ${button}
    </div>
    ${body}
  </section>`;
}

function followTitle(host: HTMLElement, prefix: string, fallback: string) {
  host.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!input.dataset.field?.startsWith(prefix)) return;
    const title = input.closest('.record')?.querySelector('h2');
    if (title) title.textContent = input.value.trim() || fallback;
  });
}

function fill(form: ParentNode, record: Json) {
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-field]').forEach((input) => {
    const key = input.dataset.field || '';
    const value = record[key];
    if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = Array.isArray(value) ? value.join('\n') : String(value ?? '');
  });
}

function readForm(form: HTMLFormElement) {
  const data: Json = {};
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-field]').forEach((input) => {
    const key = input.dataset.field || '';
    if (input instanceof HTMLInputElement && input.type === 'checkbox') data[key] = input.checked;
    else data[key] = input.value.trim();
  });
  return data;
}

async function renderOverview(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/overview');
  if (!result.ok) return say(errorsOf(result.data), true);
  const data = result.data;
  const warnings = [
    String(data.siteUrl).includes('localhost') ? 'Site adresi hâlâ localhost.' : '',
    data.adsenseSet ? '' : 'AdSense kimliği boş.',
    data.contactSet ? '' : 'İletişim e-postası boş.',
    data.newsletterSet ? '' : 'Bülten servisi bağlı değil.',
  ].filter(Boolean);
  const recent = (data.recent as { id: string; title: string; type: string; draft: boolean }[]) || [];
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="admin-grid cols-3">
      <a class="stat" href="/admin/yazilar"><span class="stat-label">Yazılar</span><strong class="stat-value">${esc(data.articles)}</strong><span class="stat-meta">${esc(data.drafts)} taslak</span></a>
      <a class="stat" href="/admin/tarifeler"><span class="stat-label">Tarifeler</span><strong class="stat-value">${esc(data.tariffs)}</strong><span class="stat-meta">${esc(data.fuels)} yakıt</span></a>
      <a class="stat" href="/admin/araclar"><span class="stat-label">Araçlar</span><strong class="stat-value">${esc(data.cars)}</strong><span class="stat-meta">Karşılaştırma kaydı</span></a>
      <a class="stat" href="/admin/yazarlar"><span class="stat-label">Kadrolar</span><strong class="stat-value">${esc(data.authors)}</strong><span class="stat-meta">Görev masası</span></a>
      <a class="stat" href="/admin/yonlendirmeler"><span class="stat-label">Yönlendirme</span><strong class="stat-value">${esc(data.redirects)}</strong><span class="stat-meta">Eski adres</span></a>
      <a class="stat" href="/admin/sss"><span class="stat-label">Sorular</span><strong class="stat-value">${esc(data.faqs)}</strong><span class="stat-meta">Sık sorulan</span></a>
      <a class="stat" href="/admin/ayarlar"><span class="stat-label">Ayarlar</span><strong class="stat-value">Meta</strong><span class="stat-meta">Sayfa açıklamaları</span></a>
    </div>
    ${recent.length ? `<section class="admin-card"><h2>Son güncellenenler</h2><div class="picker">${recent
      .map((item) => `<a href="/admin/yazilar?id=${encodeURIComponent(item.id)}"><span class="picker-body"><span class="picker-title">${esc(item.title || item.id)}</span><span class="picker-meta"><span>${item.type === 'rehber' ? 'Rehber' : 'Haber'}</span>${item.draft ? '<span class="badge">Taslak</span>' : ''}</span></span></a>`)
      .join('')}</div></section>` : ''}
    <div class="admin-note">${warnings.length ? `<ul class="warn-list">${warnings.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>Kimlik alanları dolu görünüyor.</p>'}<p>Kayıt, kaynak dosyaya yazılır. Yayındaki sayfa dev sunucusunda yenilenince güncellenir.</p></div>`,
  );
}

function categoryName(slug: string) {
  return categories.find(([id]) => id === slug)?.[1] || slug;
}

function localNow() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function shortDate(value: string) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return '';
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(time);
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function markCount(node: HTMLElement, length: number, min: number, max: number) {
  node.textContent = `${length}/${max}`;
  const bad = length > 0 && (length < min || length > max);
  node.classList.toggle('is-bad', bad);
  node.classList.toggle('is-ok', length >= min && length <= max);
}

async function renderArticles(root: HTMLElement) {
  const say = statusBox(root);
  const listed = await api('/api/admin/articles');
  if (!listed.ok) return say(errorsOf(listed.data), true);
  const authors = (listed.data.authors as { slug: string; name: string }[]) || [];
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="split writer">
      <div class="writer-list">
        <div class="writer-tools">
          <button class="btn" type="button" id="new-article">Yeni yazı</button>
          <label class="writer-search">Ara<input id="article-filter" type="search" placeholder="Başlık veya adres" /></label>
        </div>
        <div class="chips" id="article-filters">
          <button type="button" data-filter="all" aria-pressed="true">Tümü</button>
          <button type="button" data-filter="haber" aria-pressed="false">Haber</button>
          <button type="button" data-filter="rehber" aria-pressed="false">Rehber</button>
          <button type="button" data-filter="draft" aria-pressed="false">Taslak</button>
        </div>
        <p class="count" id="article-count"></p>
        <div class="picker" id="article-list"></div>
      </div>
      <div>
        <div id="article-empty" class="admin-card">
          <h2 class="editor-title">Bir yazı seç</h2>
          <p class="m-0">Listeden aç veya yeni yazı başlat. Adres, kayıtla birlikte kalıcı olur.</p>
        </div>
        <form id="article-form" class="admin-form" hidden>
          <h2 class="editor-title" id="editor-title">Yeni yazı</h2>
          <p class="admin-note">Adres yayında kalıcıdır. Sayı içeren metin, http ile başlayan kaynak adresi ister.</p>
          <div class="admin-grid cols-2" id="create-address" hidden>
            <label>Tür<select data-field="type"><option value="haber">Haber</option><option value="rehber">Rehber</option></select></label>
            <label>Adres<input data-field="slug" placeholder="ornek-yazi" spellcheck="false" /></label>
          </div>
          <p class="count" id="article-id"></p>
          <label>
            <span class="field-head">Başlık <span class="count" id="title-count"></span></span>
            <input data-field="title" />
          </label>
          <label>
            <span class="field-head">Açıklama <span class="count" id="description-count"></span></span>
            <textarea data-field="description" rows="3"></textarea>
          </label>
          <div class="admin-grid cols-2">
            <label>Kategori<select data-field="category">${categories.map(([slug, name]) => `<option value="${slug}">${name}</option>`).join('')}</select></label>
            <label>Kadro<select data-field="author">${authors.map((item) => `<option value="${esc(item.slug)}">${esc(item.name)}</option>`).join('')}</select></label>
            <label>Yayın<input data-field="publishedAt" type="datetime-local" /></label>
            <label>
              <span class="field-head">Güncelleme <button class="text-btn" type="button" id="touch-updated">Şimdi</button></span>
              <input data-field="updatedAt" type="datetime-local" />
            </label>
          </div>
          <label>Özet, satır başına bir madde<textarea data-field="summary" rows="4"></textarea></label>
          <label>Kaynaklar, satır başına ad | https://adres<textarea data-field="sources" rows="4" spellcheck="false"></textarea></label>
          <label>Metin<textarea data-field="body" rows="16"></textarea></label>
          <div class="checks">
            <label><input data-field="featured" type="checkbox" /> Öne çıkan</label>
            <label><input data-field="breaking" type="checkbox" /> Son dakika</label>
            <label><input data-field="draft" type="checkbox" /> Taslak</label>
            <label><input data-field="sponsored" type="checkbox" /> Sponsorlu</label>
            <label><input data-field="affiliate" type="checkbox" /> Bağlı bağlantı</label>
          </div>
          <div class="editor-bar">
            <button class="btn" type="submit">Kaydet</button>
            <a class="btn btn-quiet" id="view-article" href="/" hidden>Sitede aç</a>
            <button class="btn btn-danger" type="button" id="delete-article">Sil</button>
          </div>
        </form>
      </div>
    </div>`,
  );
  const list = root.querySelector<HTMLElement>('#article-list')!;
  const form = root.querySelector<HTMLFormElement>('#article-form')!;
  const empty = root.querySelector<HTMLElement>('#article-empty')!;
  const articles = (listed.data.articles as { id: string; title: string; type: string; category: string; draft: boolean; featured: boolean; updatedAt: string }[]) || [];
  let current = '';
  let mode: 'all' | 'haber' | 'rehber' | 'draft' = 'all';
  let slugManual = false;

  function paint() {
    const query = (root.querySelector<HTMLInputElement>('#article-filter')?.value || '').toLocaleLowerCase('tr-TR');
    const visible = articles.filter((item) => {
      const matchesMode = mode === 'all' || (mode === 'draft' ? item.draft : item.type === mode);
      const haystack = `${item.title} ${item.id}`.toLocaleLowerCase('tr-TR');
      return matchesMode && haystack.includes(query);
    });
    root.querySelector('#article-count')!.textContent = `${visible.length} yazı`;
    list.innerHTML = visible
      .map((item) => {
        const kind = item.type === 'rehber' ? 'Rehber' : 'Haber';
        return `<button type="button" data-id="${esc(item.id)}" ${item.id === current ? 'aria-current="true"' : ''}>
          <span class="picker-body">
            <span class="picker-title">${esc(item.title || item.id)}</span>
            <span class="picker-meta"><span>${kind}</span><span aria-hidden="true">·</span><span>${esc(categoryName(item.category))}</span><span aria-hidden="true">·</span><span>${esc(shortDate(item.updatedAt))}</span>${item.draft ? '<span class="badge">Taslak</span>' : ''}</span>
          </span>
        </button>`;
      })
      .join('') || '<p class="admin-note">Bu süzgeçte yazı yok.</p>';
  }

  function showEditor(title: string) {
    empty.hidden = true;
    form.hidden = false;
    root.querySelector('#editor-title')!.textContent = title || 'Adsız yazı';
  }

  paint();
  root.querySelector('#article-filter')?.addEventListener('input', paint);
  root.querySelector('#article-filters')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-filter]');
    if (!button?.dataset.filter) return;
    mode = button.dataset.filter as typeof mode;
    root.querySelectorAll<HTMLButtonElement>('#article-filters button').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    paint();
  });

  async function openArticle(id: string) {
    const result = await api(`/api/admin/articles?id=${encodeURIComponent(id)}`);
    if (!result.ok) return say(errorsOf(result.data), true);
    current = id;
    slugManual = true;
    root.querySelector<HTMLElement>('#create-address')!.hidden = true;
    const article = result.data;
    fill(form, {
      ...article,
      publishedAt: localValue(article.publishedAt),
      updatedAt: localValue(article.updatedAt),
      summary: article.summary,
      sources: (article.sources as { name: string; url: string }[]).map((item) => (item.url ? `${item.name} | ${item.url}` : item.name)).join('\n'),
    });
    root.querySelector('#article-id')!.textContent = id;
    const view = root.querySelector<HTMLAnchorElement>('#view-article')!;
    view.hidden = false;
    view.href = `/${id}`;
    showEditor(String(article.title || ''));
    count();
    paint();
    if (window.innerWidth < 960) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function count() {
    const title = form.querySelector<HTMLInputElement>('[data-field="title"]')?.value || '';
    const description = form.querySelector<HTMLTextAreaElement>('[data-field="description"]')?.value || '';
    markCount(root.querySelector('#title-count')!, title.trim().length, 12, 100);
    markCount(root.querySelector('#description-count')!, description.trim().length, 40, 180);
    if (!form.hidden) root.querySelector('#editor-title')!.textContent = title.trim() || 'Yeni yazı';
  }
  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.dataset.field === 'title' && !current && !slugManual) {
      const slug = form.querySelector<HTMLInputElement>('[data-field="slug"]');
      if (slug) slug.value = slugify(target.value);
    }
    if (target instanceof HTMLInputElement && target.dataset.field === 'slug') slugManual = true;
    count();
  });
  list.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
    if (button?.dataset.id) openArticle(button.dataset.id);
  });
  root.querySelector('#touch-updated')?.addEventListener('click', () => {
    const input = form.querySelector<HTMLInputElement>('[data-field="updatedAt"]');
    if (input) input.value = localNow();
  });
  root.querySelector('#new-article')?.addEventListener('click', () => {
    current = '';
    slugManual = false;
    const now = localNow();
    root.querySelector<HTMLElement>('#create-address')!.hidden = false;
    fill(form, { type: 'haber', draft: true, publishedAt: now, updatedAt: now, summary: '', sources: '', body: '', title: '', description: '', slug: '' });
    root.querySelector('#article-id')!.textContent = 'Yeni adres, kayıttan sonra kalır.';
    root.querySelector<HTMLAnchorElement>('#view-article')!.hidden = true;
    showEditor('Yeni yazı');
    count();
    paint();
    form.querySelector<HTMLInputElement>('[data-field="title"]')?.focus();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = readForm(form);
    const creating = !current;
    const id = creating ? `${data.type}/${String(data.slug || '').trim()}` : current;
    const payload = {
      id,
      ...data,
      publishedAt: withOffset(String(data.publishedAt || '')),
      updatedAt: withOffset(String(data.updatedAt || '')),
      summary: String(data.summary || '').split('\n').map((item) => item.trim()).filter(Boolean),
      sources: String(data.sources || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, url] = line.split('|').map((part) => part.trim());
          return { name, url: url || '' };
        }),
    };
    const result = await api('/api/admin/articles', { method: creating ? 'POST' : 'PUT', body: JSON.stringify(payload) });
    if (!result.ok) return say(errorsOf(result.data), true);
    const row = {
      id,
      title: String(payload.title),
      type: id.startsWith('rehber/') ? 'rehber' : 'haber',
      category: String(payload.category),
      draft: Boolean(payload.draft),
      featured: Boolean(payload.featured),
      updatedAt: String(payload.updatedAt),
    };
    const index = articles.findIndex((item) => item.id === id);
    if (index >= 0) articles[index] = { ...articles[index], ...row };
    else articles.unshift(row);
    current = id;
    root.querySelector<HTMLElement>('#create-address')!.hidden = true;
    root.querySelector('#article-id')!.textContent = id;
    const view = root.querySelector<HTMLAnchorElement>('#view-article')!;
    view.hidden = false;
    view.href = `/${id}`;
    say('Yazı dosyaya kaydedildi.');
    paint();
  });
  root.querySelector('#delete-article')?.addEventListener('click', async () => {
    if (!current || !confirm('Bu yazı silinsin mi?')) return;
    const result = await api(`/api/admin/articles?id=${encodeURIComponent(current)}`, { method: 'DELETE' });
    if (!result.ok) return say(errorsOf(result.data), true);
    const index = articles.findIndex((item) => item.id === current);
    if (index >= 0) articles.splice(index, 1);
    current = '';
    form.hidden = true;
    empty.hidden = false;
    say('Yazı silindi.');
    paint();
  });
  const requested = new URLSearchParams(location.search).get('id');
  if (requested && articles.some((item) => item.id === requested)) openArticle(requested);
}

async function renderTariffs(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/tariffs');
  if (!result.ok) return say(errorsOf(result.data), true);
  const data = result.data as Json & { items: Json[]; fuels: Json[]; source: Json };
  root.insertAdjacentHTML(
    'beforeend',
    `<form id="tariff-form" class="stack panel-form">
      <p class="admin-note">Dolu fiyat, kaynak adresi ve tarih ister. Boş hücre sitede köşeli parantezde kalır.</p>
      ${record('Elektrik kaynağı', String(data.updatedAt || ''), `${field('Kaynak adı', 'sourceName', String(data.source?.name || ''), 'textarea')}${field('Kaynak adresi', 'sourceUrl', String(data.source?.url || ''), 'url', 'https://')}${field('Tarih', 'updatedAt', String(data.updatedAt || ''), 'text', '2026-04-04')}`)}
      <h2 class="section-title">Elektrik</h2>
      <p class="count" id="tariff-count"></p>
      <div id="tariff-items" class="stack"></div>
      <h2 class="section-title">Yakıt</h2>
      <div id="fuel-items" class="stack"></div>
      <div class="panel-actions"><button class="btn btn-quiet" type="button" id="add-tariff">Elektrik ekle</button><button class="btn btn-quiet" type="button" id="add-fuel">Yakıt ekle</button><button class="btn" type="submit">Kaydet</button></div>
    </form>`,
  );
  const items = root.querySelector<HTMLElement>('#tariff-items')!;
  const fuels = root.querySelector<HTMLElement>('#fuel-items')!;
  const places = [['ev', 'Ev'], ['istasyon', 'İstasyon']] as const;
  const draw = () => {
    root.querySelector('#tariff-count')!.textContent = `${data.items.length} elektrik satırı, ${data.fuels.length} yakıt satırı`;
    items.innerHTML = data.items.map((row, index) => {
      const place = String(row.place || 'ev');
      const options = places.some(([id]) => id === place) ? places : [...places, [place, place] as const];
      return record(String(row.name || 'Yeni elektrik satırı'), `${money(row.pricePerKwhTry, 'TL/kWh')} · ${place === 'istasyon' ? 'İstasyon' : 'Ev'}`, `
      <div class="admin-grid cols-2">
        ${field('Kod', `item-id-${index}`, String(row.id || ''), 'text', 'mesken-yuksek')}
        ${selectField('Yer', `item-place-${index}`, place, options)}
      </div>
      ${field('Ad', `item-name-${index}`, String(row.name || ''))}
      ${field('TL/kWh, boş kalabilir', `item-price-${index}`, row.pricePerKwhTry == null ? '' : String(row.pricePerKwhTry), 'text', '4,857048')}
      ${field('Not', `item-note-${index}`, String(row.note || ''), 'textarea')}`, `data-remove-item="${index}"`);
    }).join('') || '<p class="admin-note">Elektrik satırı yok.</p>';
    fuels.innerHTML = (data.fuels || []).map((row, index) => {
      const source = (row.source || {}) as Json;
      return record(String(row.name || 'Yeni yakıt satırı'), money(row.pricePerLitreTry, 'TL/litre'), `
        <div class="admin-grid cols-2">
          ${field('Kod', `fuel-id-${index}`, String(row.id || ''), 'text', 'benzin-95')}
          ${field('TL/litre', `fuel-price-${index}`, row.pricePerLitreTry == null ? '' : String(row.pricePerLitreTry))}
          ${field('Tarih', `fuel-date-${index}`, String(row.updatedAt || ''), 'text', '2026-11-21')}
        </div>
        ${field('Ad', `fuel-name-${index}`, String(row.name || ''))}
        ${field('Kaynak adı', `fuel-source-${index}`, String(source.name || ''), 'textarea')}
        ${field('Kaynak adresi', `fuel-url-${index}`, String(source.url || ''), 'url', 'https://')}`, `data-remove-fuel="${index}"`);
    }).join('') || '<p class="admin-note">Yakıt satırı yok.</p>';
  };
  followTitle(root.querySelector('#tariff-form')!, 'item-name-', 'Yeni elektrik satırı');
  followTitle(root.querySelector('#tariff-form')!, 'fuel-name-', 'Yeni yakıt satırı');
  const valueOf = (name: string) => root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`)?.value.trim() ?? '';
  const collect = () => {
    data.updatedAt = valueOf('updatedAt');
    data.source = { name: valueOf('sourceName'), url: valueOf('sourceUrl') };
    data.items = data.items.map((_, index) => ({
      id: valueOf(`item-id-${index}`),
      name: valueOf(`item-name-${index}`),
      place: valueOf(`item-place-${index}`),
      pricePerKwhTry: valueOf(`item-price-${index}`),
      note: valueOf(`item-note-${index}`),
    }));
    data.fuels = (data.fuels || []).map((_, index) => ({
      id: valueOf(`fuel-id-${index}`),
      name: valueOf(`fuel-name-${index}`),
      pricePerLitreTry: valueOf(`fuel-price-${index}`),
      updatedAt: valueOf(`fuel-date-${index}`),
      source: { name: valueOf(`fuel-source-${index}`), url: valueOf(`fuel-url-${index}`) },
    }));
  };
  draw();
  root.querySelector('#add-tariff')?.addEventListener('click', () => {
    collect();
    data.items.push({ id: '', name: '', place: 'ev', pricePerKwhTry: '', note: '' });
    draw();
  });
  root.querySelector('#add-fuel')?.addEventListener('click', () => {
    collect();
    data.fuels.push({ id: '', name: '', pricePerLitreTry: '', updatedAt: '', source: { name: '', url: '' } });
    draw();
  });
  root.addEventListener('click', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-item]');
    const fuel = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-fuel]');
    if (!item && !fuel) return;
    if (!confirm('Bu satır silinsin mi?')) return;
    collect();
    if (item) data.items.splice(Number(item.dataset.removeItem), 1);
    if (fuel) data.fuels.splice(Number(fuel.dataset.removeFuel), 1);
    draw();
  });
  root.querySelector('#tariff-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = valueOf;
    const payload = {
      updatedAt: value('updatedAt'),
      source: { name: value('sourceName'), url: value('sourceUrl') },
      items: data.items.map((_, index) => ({
        id: value(`item-id-${index}`),
        name: value(`item-name-${index}`),
        place: value(`item-place-${index}`),
        pricePerKwhTry: value(`item-price-${index}`),
        note: value(`item-note-${index}`),
      })),
      fuels: data.fuels.map((_, index) => ({
        id: value(`fuel-id-${index}`),
        name: value(`fuel-name-${index}`),
        pricePerLitreTry: value(`fuel-price-${index}`),
        updatedAt: value(`fuel-date-${index}`),
        source: { name: value(`fuel-source-${index}`), url: value(`fuel-url-${index}`) },
      })),
    };
    const saved = await api('/api/admin/tariffs', { method: 'PUT', body: JSON.stringify(payload) });
    say(saved.ok ? 'Tarifeler kaydedildi.' : errorsOf(saved.data), !saved.ok);
  });
}

async function renderCars(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/cars');
  if (!result.ok) return say(errorsOf(result.data), true);
  const rows = result.data as Json[];
  root.insertAdjacentHTML('beforeend', `<form id="car-form" class="stack panel-form"><p class="admin-note">Sayı varken kaynak adresi ve güncelleme tarihi zorunlu. Boş hücre sitede köşeli parantezde kalır. Adreste -vs- olmaz.</p><p class="count" id="car-count"></p><div id="cars" class="stack"></div><div class="panel-actions"><button class="btn btn-quiet" type="button" id="add-car">Araç ekle</button><button class="btn" type="submit">Kaydet</button></div></form>`);
  const host = root.querySelector<HTMLElement>('#cars')!;
  const draw = () => {
    root.querySelector('#car-count')!.textContent = `${rows.length} araç`;
    host.innerHTML = rows.map((row, index) => {
      const source = (row.source || {}) as Json;
      const priced = row.priceTry == null || row.priceTry === '' ? 'Fiyat kayıtlı değil' : money(row.priceTry, 'TL');
      return record(String(row.name || 'Yeni araç'), `${row.brand ? `${String(row.brand)} · ` : ''}${priced}`, `
        <p class="group-label">Kimlik</p>
        <div class="admin-grid cols-2">
          ${field('Adres', `slug-${index}`, String(row.slug || ''), 'text', 'model-a')}
          ${field('Marka', `brand-${index}`, String(row.brand || ''))}
        </div>
        ${field('Ad', `name-${index}`, String(row.name || ''))}
        <p class="group-label">Ölçüler</p>
        <div class="admin-grid cols-2">
          ${field('Fiyat TL', `price-${index}`, row.priceTry == null ? '' : String(row.priceTry))}
          ${field('Menzil km', `range-${index}`, row.rangeKm == null ? '' : String(row.rangeKm))}
          ${field('Batarya kWh', `battery-${index}`, row.batteryKwh == null ? '' : String(row.batteryKwh))}
          ${field('DC kW', `dc-${index}`, row.dcKw == null ? '' : String(row.dcKw))}
          ${field('10-80 dk', `charge-${index}`, row.charge10to80Min == null ? '' : String(row.charge10to80Min))}
          ${field('Garanti', `warranty-${index}`, row.warranty == null ? '' : String(row.warranty))}
        </div>
        <p class="group-label">Kaynak</p>
        ${field('Kaynak adı', `source-${index}`, source.name == null ? '' : String(source.name))}
        ${field('Kaynak adresi', `url-${index}`, source.url == null ? '' : String(source.url), 'url', 'https://')}
        ${field('Güncelleme', `date-${index}`, row.updatedAt == null ? '' : String(row.updatedAt), 'text', '2026-11-22')}`, `data-remove="${index}"`);
    }).join('') || '<p class="admin-note">Kayıtlı araç yok.</p>';
  };
  followTitle(host, 'name-', 'Yeni araç');
  const carValue = (name: string) => root.querySelector<HTMLInputElement>(`[data-field="${name}"]`)?.value.trim() ?? '';
  const collectCars = () => {
    if (!host.querySelector('[data-field]') && rows.length) return;
    const next = rows.map((_, index) => ({
      slug: carValue(`slug-${index}`),
      name: carValue(`name-${index}`),
      brand: carValue(`brand-${index}`),
      priceTry: carValue(`price-${index}`),
      rangeKm: carValue(`range-${index}`),
      batteryKwh: carValue(`battery-${index}`),
      dcKw: carValue(`dc-${index}`),
      charge10to80Min: carValue(`charge-${index}`),
      warranty: carValue(`warranty-${index}`),
      source: { name: carValue(`source-${index}`), url: carValue(`url-${index}`) },
      updatedAt: carValue(`date-${index}`),
    }));
    rows.splice(0, rows.length, ...next);
  };
  draw();
  root.querySelector('#add-car')?.addEventListener('click', () => {
    collectCars();
    rows.push({ slug: '', name: '', brand: '', priceTry: '', rangeKm: '', batteryKwh: '', dcKw: '', charge10to80Min: '', warranty: '', source: { name: '', url: '' }, updatedAt: '' });
    draw();
  });
  host.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button || !confirm('Bu araç silinsin mi?')) return;
    collectCars();
    rows.splice(Number(button.dataset.remove), 1);
    draw();
  });
  root.querySelector('#car-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const value = (name: string) => form.querySelector<HTMLInputElement>(`[data-field="${name}"]`)?.value.trim() || '';
    const payload = rows.map((_, index) => ({
      slug: value(`slug-${index}`),
      name: value(`name-${index}`),
      brand: value(`brand-${index}`),
      priceTry: value(`price-${index}`),
      rangeKm: value(`range-${index}`),
      batteryKwh: value(`battery-${index}`),
      dcKw: value(`dc-${index}`),
      charge10to80Min: value(`charge-${index}`),
      warranty: value(`warranty-${index}`),
      source: { name: value(`source-${index}`), url: value(`url-${index}`) },
      updatedAt: value(`date-${index}`),
    }));
    const saved = await api('/api/admin/cars', { method: 'PUT', body: JSON.stringify(payload) });
    say(saved.ok ? 'Araçlar kaydedildi.' : errorsOf(saved.data), !saved.ok);
  });
}

async function renderAuthors(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/authors');
  if (!result.ok) return say(errorsOf(result.data), true);
  const rows = result.data as Json[];
  root.insertAdjacentHTML('beforeend', `<form id="author-form" class="stack panel-form"><p class="admin-note">Görev adı uydurma. Yazısı olan kadro silinemez. Ortak imza, yayımlanmış metinlerin adresidir.</p><p class="count" id="author-count"></p><div id="authors" class="stack"></div><div class="panel-actions"><button class="btn btn-quiet" type="button" id="add-author">Kadro ekle</button><button class="btn" type="submit">Kaydet</button></div></form>`);
  const host = root.querySelector<HTMLElement>('#authors')!;
  const authorValue = (name: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`)?.value.trim() ?? '';
  const collectAuthors = () => {
    if (!host.querySelector('[data-field]') && rows.length) return;
    const next = rows.map((_, index) => ({
      slug: authorValue(`slug-${index}`),
      name: authorValue(`name-${index}`),
      jobTitle: authorValue(`job-${index}`),
      duty: authorValue(`duty-${index}`),
      expertise: authorValue(`expertise-${index}`).split('\n').map((item) => item.trim()).filter(Boolean),
      bio: authorValue(`bio-${index}`),
    }));
    rows.splice(0, rows.length, ...next);
  };
  const draw = () => {
    root.querySelector('#author-count')!.textContent = `${rows.length} kadro`;
    host.innerHTML = rows.map((row, index) => record(String(row.name || 'Yeni kadro'), String(row.jobTitle || ''), `
      <div class="admin-grid cols-2">
        ${field('Adres', `slug-${index}`, String(row.slug || ''), 'text', 'haber-editoru')}
        ${field('Görev', `job-${index}`, String(row.jobTitle || ''))}
      </div>
      ${field('Görünen ad', `name-${index}`, String(row.name || ''))}
      ${field('Sorumluluk', `duty-${index}`, String(row.duty || ''), 'textarea')}
      ${field('Uzmanlık, satır başına bir madde', `expertise-${index}`, ((row.expertise as string[]) || []).join('\n'), 'textarea')}
      ${field('Tanıtım', `bio-${index}`, String(row.bio || ''), 'textarea')}`, `data-remove="${index}"`)).join('') || '<p class="admin-note">Kadro yok.</p>';
  };
  followTitle(host, 'name-', 'Yeni kadro');
  draw();
  root.querySelector('#add-author')?.addEventListener('click', () => {
    collectAuthors();
    rows.push({ slug: '', name: '', jobTitle: '', duty: '', expertise: [], bio: '' });
    draw();
  });
  host.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button || !confirm('Bu kadro silinsin mi? Yazısı varsa kayıt reddedilir.')) return;
    collectAuthors();
    rows.splice(Number(button.dataset.remove), 1);
    draw();
  });
  root.querySelector('#author-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const value = (name: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`)?.value.trim() || '';
    const payload = rows.map((_, index) => ({
      slug: value(`slug-${index}`),
      name: value(`name-${index}`),
      jobTitle: value(`job-${index}`),
      duty: value(`duty-${index}`),
      expertise: value(`expertise-${index}`).split('\n').map((item) => item.trim()).filter(Boolean),
      bio: value(`bio-${index}`),
    }));
    const saved = await api('/api/admin/authors', { method: 'PUT', body: JSON.stringify(payload) });
    say(saved.ok ? 'Kadrolar kaydedildi.' : errorsOf(saved.data), !saved.ok);
  });
}

async function renderRedirects(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/redirects');
  if (!result.ok) return say(errorsOf(result.data), true);
  const rows = result.data as { from: string; to: string }[];
  root.insertAdjacentHTML('beforeend', `<form id="redirect-form" class="stack panel-form"><p class="admin-note">Adresler / ile başlar, / ile bitmez. Karşılaştırmanın ters yazılışı bunu beklemez; o yönlendirme kendiliğinden vardır. Değişiklik yeni derlemede devreye girer.</p><p class="count" id="redirect-count"></p><div id="redirects" class="stack"></div><div class="panel-actions"><button class="btn btn-quiet" type="button" id="add-redirect">Satır ekle</button><button class="btn" type="submit">Kaydet</button></div></form>`);
  const host = root.querySelector<HTMLElement>('#redirects')!;
  const redirectValue = (name: string) => host.querySelector<HTMLInputElement>(`[data-field="${name}"]`)?.value.trim() ?? '';
  const collectRedirects = () => {
    if (!host.querySelector('[data-field]') && rows.length) return;
    const next = rows.map((_, index) => ({ from: redirectValue(`from-${index}`), to: redirectValue(`to-${index}`) }));
    rows.splice(0, rows.length, ...next);
  };
  const draw = () => {
    root.querySelector('#redirect-count')!.textContent = `${rows.length} yönlendirme`;
    host.innerHTML = rows.map((row, index) => record('Yönlendirme', '', `<div class="admin-grid cols-2">${field('Eski adres', `from-${index}`, row.from, 'text', '/eski-adres')}${field('Yeni adres', `to-${index}`, row.to, 'text', '/yeni-adres')}</div>`, `data-remove="${index}"`)).join('') || '<p class="admin-note">Kayıtlı yönlendirme yok.</p>';
  };
  draw();
  root.querySelector('#add-redirect')?.addEventListener('click', () => {
    collectRedirects();
    rows.push({ from: '', to: '' });
    draw();
  });
  host.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button || !confirm('Bu yönlendirme silinsin mi?')) return;
    collectRedirects();
    rows.splice(Number(button.dataset.remove), 1);
    draw();
  });
  root.querySelector('#redirect-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const value = (name: string) => form.querySelector<HTMLInputElement>(`[data-field="${name}"]`)?.value.trim() || '';
    const payload = rows.map((_, index) => ({ from: value(`from-${index}`), to: value(`to-${index}`) }));
    const saved = await api('/api/admin/redirects', { method: 'PUT', body: JSON.stringify(payload) });
    say(saved.ok ? 'Yönlendirmeler kaydedildi. Yeni derlemede uygulanır.' : errorsOf(saved.data), !saved.ok);
  });
}

async function renderFaq(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/faq');
  if (!result.ok) return say(errorsOf(result.data), true);
  const rows = result.data as { question: string; answer: string }[];
  root.insertAdjacentHTML('beforeend', `<form id="faq-form" class="stack panel-form"><p class="admin-note">Yanıt, sitede görünen metindir. Kaynak uydurma.</p><p class="count" id="faq-count"></p><div id="faqs" class="stack"></div><div class="panel-actions"><button class="btn btn-quiet" type="button" id="add-faq">Soru ekle</button><button class="btn" type="submit">Kaydet</button></div></form>`);
  const host = root.querySelector<HTMLElement>('#faqs')!;
  const faqValue = (name: string) => host.querySelector<HTMLTextAreaElement>(`[data-field="${name}"]`)?.value.trim() ?? '';
  const collectFaq = () => {
    if (!host.querySelector('[data-field]') && rows.length) return;
    const next = rows.map((_, index) => ({ question: faqValue(`q-${index}`), answer: faqValue(`a-${index}`) }));
    rows.splice(0, rows.length, ...next);
  };
  const draw = () => {
    root.querySelector('#faq-count')!.textContent = `${rows.length} soru`;
    host.innerHTML = rows.map((row, index) => {
      const title = String(row.question || 'Yeni soru');
      return record(title.length > 90 ? `${title.slice(0, 87)}…` : title, '', `${field('Soru', `q-${index}`, row.question, 'textarea')}${field('Yanıt', `a-${index}`, row.answer, 'textarea')}`, `data-remove="${index}"`);
    }).join('') || '<p class="admin-note">Soru yok.</p>';
  };
  followTitle(host, 'q-', 'Yeni soru');
  draw();
  root.querySelector('#add-faq')?.addEventListener('click', () => {
    collectFaq();
    rows.push({ question: '', answer: '' });
    draw();
  });
  host.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button || !confirm('Bu soru silinsin mi?')) return;
    collectFaq();
    rows.splice(Number(button.dataset.remove), 1);
    draw();
  });
  root.querySelector('#faq-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const value = (name: string) => form.querySelector<HTMLTextAreaElement>(`[data-field="${name}"]`)?.value.trim() || '';
    const payload = rows.map((_, index) => ({ question: value(`q-${index}`), answer: value(`a-${index}`) }));
    const saved = await api('/api/admin/faq', { method: 'PUT', body: JSON.stringify(payload) });
    say(saved.ok ? 'Sorular kaydedildi.' : errorsOf(saved.data), !saved.ok);
  });
}

const pageMetaFields = [
  ['home', 'Ana sayfa', '/'],
  ['haber', 'Haberler', '/haber'],
  ['rehber', 'Rehberler', '/rehber'],
  ['karsilastir', 'Karşılaştırma', '/karsilastir'],
  ['arac', 'Araçlar', '/arac'],
  ['hesaplayici', 'Şarj hesaplayıcı', '/arac/hesaplayici'],
  ['rota', 'Rota planlayıcı', '/arac/rota'],
  ['yakit', 'Yakıt gideri', '/arac/yakit'],
  ['yazarlar', 'Kadrolar', '/yazar'],
  ['arama', 'Arama', '/ara'],
  ['bulunamadi', 'Sayfa yok', '/404'],
  ['hakkimizda', 'Hakkımızda', '/hakkimizda'],
  ['kunye', 'Künye', '/kunye'],
  ['ilkeler', 'Yayın ilkeleri', '/yayin-ilkeleri'],
  ['duzeltme', 'Düzeltme', '/duzeltme-politikasi'],
  ['reklam', 'Reklam', '/reklam-politikasi'],
  ['gizlilik', 'Gizlilik', '/gizlilik'],
  ['kvkk', 'KVKK', '/kvkk'],
  ['cerez', 'Çerez', '/cerez-politikasi'],
  ['iletisim', 'İletişim', '/iletisim'],
] as const;

function countedArea(key: string, label: string, hint: string, value: string) {
  return `<label>
    <span class="field-head">${esc(label)} <span class="count" data-count="${esc(key)}"></span></span>
    <span class="field-hint">${esc(hint)}</span>
    <textarea data-field="${esc(key)}" data-min="40" data-max="180" rows="3">${esc(value)}</textarea>
  </label>`;
}

function activeLine(fileValue: string, envValue: string) {
  const active = fileValue.trim() || envValue.trim();
  return `<p class="field-hint">Sitede şu an: ${active ? esc(active) : 'kapalı'}</p>`;
}

async function renderSettings(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/settings');
  if (!result.ok) return say(errorsOf(result.data), true);
  const settings = result.data.settings as Json;
  const env = (result.data.env || {}) as Json;
  const envSlots = (env.adSlots || {}) as Json;
  const slots = (settings.adSlots || {}) as Json;
  const meta = (settings.meta || {}) as Json;
  const categoryCopy = (settings.categories || {}) as Json;
  const slotFields: [string, string][] = [
    ['homeTop', 'Ana sayfa üst'],
    ['homeMid', 'Ana sayfa orta'],
    ['early', 'Yazı başı, yalnızca dar ekran'],
    ['mid', 'Yazı ortası'],
    ['late', 'Yazı sonu'],
    ['sidebar', 'Kenar, yalnızca geniş ekran'],
  ];
  root.insertAdjacentHTML(
    'beforeend',
    `<form id="settings-form" class="stack panel-form">
      <p class="admin-note">Boş bağlantı alanı .env değerini kullanır. Dolu alan onu ezer. Şifre bu ekrana yazılmaz. Tüzel unvan, adres, MERSİS, KEP ve telefon buradan girilmez. Yazı açıklaması Yazılar sekmesindedir.</p>
      <nav class="jump" aria-label="Ayar bölümleri">
        <a href="#ayar-yayin">Yayın</a>
        <a href="#ayar-meta">Meta</a>
        <a href="#ayar-kategori">Kategoriler</a>
        <a href="#ayar-baglanti">Bağlantı</a>
        <a href="#ayar-reklam">Reklam</a>
        <a href="#ayar-olcum">Ölçüm</a>
      </nav>
      <section class="record anchor" id="ayar-yayin">
        <div class="record-head"><div class="record-copy"><h2>Yayın</h2><p class="record-meta">Logo yazısı Benzinsiz kalır. Ad, sekme başlığında ve şemada kullanılır.</p></div></div>
        ${field('Yayın adı', 'siteName', String(settings.siteName || ''))}
        ${field('Slogan', 'slogan', String(settings.slogan || ''))}
      </section>
      <section class="stack anchor" id="ayar-meta">
        <h2 class="section-title">Meta açıklamaları</h2>
        <p class="count">40–180 karakter. Sayfa 2 ve sonrası aynı metni kullanır. Google sonucunda yaklaşık 150 karakter görünür.</p>
        ${pageMetaFields.map(([key, label, path]) => countedArea(`meta-${key}`, label, path, String(meta[key] || ''))).join('')}
      </section>
      <section class="stack anchor" id="ayar-kategori">
        <h2 class="section-title">Kategori açıklamaları</h2>
        <p class="count">Kategori sayfasının meta açıklaması ve giriş cümlesi.</p>
        ${categories.map(([slug, name]) => countedArea(`cat-${slug}`, name, `/kategori/${slug}`, String(categoryCopy[slug] || ''))).join('')}
      </section>
      <section class="record anchor" id="ayar-baglanti">
        <div class="record-head"><div class="record-copy"><h2>Bağlantı</h2><p class="record-meta">Site haritası, derlemede .env adresini okur.</p></div></div>
        ${field('Kanonik adres', 'siteUrl', String(settings.siteUrl || ''), 'url', 'https://benzinsiz.com')}
        ${activeLine(String(settings.siteUrl || ''), String(env.siteUrl || ''))}
        ${field('İletişim e-postası', 'contactEmail', String(settings.contactEmail || ''), 'email', 'ornek@benzinsiz.com')}
        ${activeLine(String(settings.contactEmail || ''), String(env.contactEmail || ''))}
        ${field('İletişim formu adresi', 'contactEndpoint', String(settings.contactEndpoint || ''), 'url', 'https://')}
        ${activeLine(String(settings.contactEndpoint || ''), String(env.contactEndpoint || ''))}
      </section>
      <section class="record anchor" id="ayar-reklam">
        <div class="record-head"><div class="record-copy"><h2>Reklam</h2><p class="record-meta">Kimlik veya alan boşsa reklam kutusu çizilmez. Otomatik reklam yok.</p></div></div>
        ${field('AdSense yayıncı kimliği', 'adsensePublisherId', String(settings.adsensePublisherId || ''), 'text', 'pub-')}
        ${activeLine(String(settings.adsensePublisherId || ''), String(env.adsensePublisherId || ''))}
        <div class="admin-grid cols-2">
          ${slotFields.map(([key, label]) => `<div>${field(label, `slot-${key}`, String(slots[key] || ''), 'text', '1234567890')}${activeLine(String(slots[key] || ''), String(envSlots[key] || ''))}</div>`).join('')}
        </div>
      </section>
      <section class="record anchor" id="ayar-olcum">
        <div class="record-head"><div class="record-copy"><h2>Ölçüm ve bülten</h2><p class="record-meta">Betikler, çerez onayı ve boşluktan sonra yüklenir.</p></div></div>
        ${selectField('Ölçüm', 'analytics', String(settings.analytics || ''), [['', '.env değerini kullan'], ['plausible', 'Plausible'], ['ga4', 'GA4']])}
        ${activeLine(String(settings.analytics || ''), String(env.analytics || ''))}
        ${field('Plausible alan adı', 'plausibleDomain', String(settings.plausibleDomain || ''), 'text', 'benzinsiz.com')}
        ${field('Plausible betik adresi', 'plausibleSrc', String(settings.plausibleSrc || ''), 'url', 'https://plausible.io/js/script.js')}
        ${field('GA4 kimliği', 'ga4Id', String(settings.ga4Id || ''), 'text', 'G-')}
        ${field('CMP betik adresi', 'cmpScriptUrl', String(settings.cmpScriptUrl || ''), 'url', 'https://')}
        ${field('Bülten adresi', 'newsletterEndpoint', String(settings.newsletterEndpoint || ''), 'url', 'https://')}
        ${selectField('Bülten biçimi', 'newsletterFormat', String(settings.newsletterFormat || ''), [['', '.env değerini kullan'], ['json', 'JSON'], ['form', 'Form']])}
        <p class="field-hint">Şifre .env içindeki ADMIN_PASSWORD satırındadır. Değişince npm run dev yeniden başlar.</p>
      </section>
      <div class="panel-actions"><button class="btn" type="submit">Kaydet</button></div>
    </form>`,
  );
  const form = root.querySelector<HTMLFormElement>('#settings-form')!;
  const paint = () => {
    form.querySelectorAll<HTMLTextAreaElement>('textarea[data-min]').forEach((node) => {
      const min = Number(node.dataset.min);
      const max = Number(node.dataset.max);
      const badge = form.querySelector<HTMLElement>(`[data-count="${node.dataset.field}"]`);
      if (!badge) return;
      const length = node.value.trim().length;
      badge.textContent = `${length}/${max}`;
      badge.classList.toggle('is-bad', length < min || length > max);
      badge.classList.toggle('is-ok', length >= min && length <= max);
    });
  };
  paint();
  form.addEventListener('input', paint);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = (name: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-field="${name}"]`)?.value.trim() || '';
    const payload = {
      siteName: value('siteName'),
      slogan: value('slogan'),
      siteUrl: value('siteUrl'),
      contactEmail: value('contactEmail'),
      contactEndpoint: value('contactEndpoint'),
      analytics: value('analytics'),
      plausibleDomain: value('plausibleDomain'),
      plausibleSrc: value('plausibleSrc'),
      ga4Id: value('ga4Id'),
      cmpScriptUrl: value('cmpScriptUrl'),
      newsletterEndpoint: value('newsletterEndpoint'),
      newsletterFormat: value('newsletterFormat'),
      adsensePublisherId: value('adsensePublisherId'),
      adSlots: Object.fromEntries(slotFields.map(([key]) => [key, value(`slot-${key}`)])),
      meta: Object.fromEntries(pageMetaFields.map(([key]) => [key, value(`meta-${key}`)])),
      categories: Object.fromEntries(categories.map(([slug]) => [slug, value(`cat-${slug}`)])),
    };
    const saved = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
    say(saved.ok ? 'Ayarlar kaydedildi. Açık sayfa yenilenince meta açıklaması güncellenir.' : errorsOf(saved.data), !saved.ok);
  });
}

export function bootAdmin() {
  const panel = document.body.dataset.panel || '';
  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' });
    location.href = '/admin/giris';
  });
  const form = document.querySelector<HTMLFormElement>('#login-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector<HTMLElement>('#login-status');
    const password = new FormData(form).get('password');
    const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
    if (!result.ok) {
      if (status) {
        status.hidden = false;
        status.textContent = errorsOf(result.data);
        status.classList.add('is-error');
      }
      return;
    }
    location.href = '/admin';
  });
  if (panel === 'giris') {
    api('/api/admin/session').then((result) => {
      if (result.data.ok) location.href = '/admin';
    });
    return;
  }
  const root = document.querySelector<HTMLElement>('#panel');
  if (!root) return;
  api('/api/admin/session').then((result) => {
    if (result.status === 0 || result.status === 404) {
      root.innerHTML = '<p class="admin-note">Kayıt servisi yok. Yönetim dosyaya ancak npm run dev açıkken yazar. Önizleme sunucusu yetmez.</p>';
      return;
    }
    if (!result.data.configured) {
      root.innerHTML = '<p class="admin-note">ADMIN_PASSWORD boş. .env dosyasına yazıp npm run dev sunucusunu yeniden başlat.</p>';
      return;
    }
    if (!result.data.ok) {
      location.href = '/admin/giris';
      return;
    }
    const screens: Record<string, (node: HTMLElement) => Promise<void>> = {
      ozet: renderOverview,
      yazilar: renderArticles,
      tarifeler: renderTariffs,
      araclar: renderCars,
      yazarlar: renderAuthors,
      yonlendirmeler: renderRedirects,
      sss: renderFaq,
      ayarlar: renderSettings,
    };
    screens[panel]?.(root);
  });
}
