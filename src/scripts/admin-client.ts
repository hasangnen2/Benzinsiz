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

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function errorsOf(data: Json) {
  if (Array.isArray(data.errors)) return data.errors.map(String).join(' ');
  return String(data.error || 'Kayıt olmadı.');
}

function istanbulStamp(date: Date) {
  const text = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return text.replace(' ', 'T').slice(0, 16);
}

function localValue(value: unknown) {
  const time = Date.parse(String(value || ''));
  if (Number.isNaN(time)) return '';
  return istanbulStamp(new Date(time));
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
  const recent = (data.recent as { id: string; title: string; type: string; draft: boolean }[]) || [];
  const checks = (data.checks as { label: string; ok: boolean; manual: boolean }[]) || [];
  const automatic = checks.filter((item) => !item.manual);
  const done = automatic.filter((item) => item.ok).length;
  const total = Math.max(automatic.length, 1);
  const notices = [
    Number(data.metaMissing) > 0 ? { text: `${data.metaMissing} yazıda meta açıklaması eksik`, href: '/admin/yazilar', kind: 'is-bad' } : null,
    data.adsTxt ? null : { text: 'ads.txt doğrulanmadı', href: '/admin/reklam', kind: 'is-bad' },
    String(data.siteUrl).includes('localhost') ? { text: 'Site adresi hâlâ localhost', href: '/admin/ayarlar#ayar-baglanti', kind: 'is-warn' } : null,
  ].filter((item) => item !== null);
  const actionName: Record<string, string> = {
    oturum: 'Oturum', yazi: 'Yazı', 'yazi-durum': 'Yazı durumu', 'yazi-sil': 'Yazı silindi', tarife: 'Tarife', arac: 'Araç', kadro: 'Kadro', yonlendirme: 'Yönlendirme', soru: 'Soru', kategori: 'Kategori', medya: 'Medya', 'medya-sil': 'Medya silindi', menu: 'Menü', ayar: 'Ayar', yedek: 'Yedek',
  };
  const scheduled = (data.scheduled as { id: string; title: string; publishedAt: string }[]) || [];
  const activity = (data.activity as { at: string; action: string; target: string }[]) || [];
  const when = (value: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(value));
  root.insertAdjacentHTML(
    'beforeend',
    `<p class="lead">Sitenin durumu ve bugün dikkat etmen gerekenler.</p>
    ${notices.length ? `<section class="attention"><strong>Dikkat gerektirenler</strong>${notices.map((item) => `<a class="chip ${item.kind}" href="${esc(item.href)}">${esc(item.text)}</a>`).join('')}</section>` : '<p class="admin-note">Dikkat gerektiren kayıt yok.</p>'}
    <div class="admin-grid cols-4">
      <a class="stat" href="/admin/yazilar"><span class="stat-label">Yazılar</span><strong class="stat-value">${esc(data.articles)}</strong><span class="chip is-warn">${esc(data.drafts)} taslak</span></a>
      <a class="stat" href="/admin/tarifeler"><span class="stat-label">Tarifeler</span><strong class="stat-value">${esc(data.tariffs)}</strong><span class="stat-meta">${esc(data.fuels)} yakıt türü</span></a>
      <a class="stat" href="/admin/araclar"><span class="stat-label">Araçlar</span><strong class="stat-value">${esc(data.cars)}</strong><span class="stat-meta">Karşılaştırma kaydı</span></a>
      <a class="stat" href="/admin/sss"><span class="stat-label">Sık sorulan sorular</span><strong class="stat-value">${esc(data.faqs)}</strong><span class="stat-meta">Yayında</span></a>
    </div>
    <div class="dash">
      <div class="dash-main">
        <section class="admin-card">
          <div class="row"><div><h2>AdSense onay hazırlığı</h2><p class="stat-meta">${done} / ${automatic.length} otomatik adım tamam</p></div><span class="chip ${done === automatic.length ? 'is-ok' : 'is-warn'}">${done === automatic.length ? 'Tamam' : 'Eksikler var'}</span></div>
          <div class="bar" role="progressbar" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}" aria-label="AdSense hazırlığı"><i style="width:${Math.round((done / total) * 100)}%"></i></div>
          ${checks.map((item) => `<div class="row"><span>${esc(item.label)}</span><span class="chip ${item.manual ? 'is-warn' : item.ok ? 'is-ok' : 'is-bad'}">${item.manual ? 'İşaretlenmedi' : item.ok ? 'Tamam' : 'Eksik'}</span></div>`).join('')}
        </section>
        <section class="admin-card">
          <div class="row"><h2>Son güncellenenler</h2><a class="text-link" href="/admin/yazilar">Tüm yazılar</a></div>
          ${recent.map((item) => `<div class="row"><div><a class="text-link" href="/admin/yazilar?id=${encodeURIComponent(item.id)}">${esc(item.title || item.id)}</a><p class="stat-meta">${item.type === 'rehber' ? 'Rehber' : 'Haber'} · ${item.draft ? 'Taslak' : 'Yayında'}</p></div><a class="btn btn-quiet" href="/admin/yazilar?id=${encodeURIComponent(item.id)}">Düzenle</a></div>`).join('') || '<p class="stat-meta">Yazı yok.</p>'}
        </section>
        <section class="admin-card compact-list">
          <h2>Diğer kayıtlar</h2>
          <a class="row" href="/admin/yazarlar"><span>Kadrolar</span><span class="stat-meta">${esc(data.authors)} görev</span></a>
          <a class="row" href="/admin/yonlendirmeler"><span>Yönlendirme</span><span class="stat-meta">${esc(data.redirects)} adres</span></a>
          <a class="row" href="/admin/ayarlar"><span>Ayarlar</span><span class="stat-meta">Meta açıklamaları</span></a>
        </section>
      </div>
      <aside class="dash-side">
        <section class="admin-card">
          <h2>Hızlı işlemler</h2>
          <div class="quick">
            <a class="btn btn-quiet" href="/admin/yazilar?yeni=1">Yeni yazı</a>
            <a class="btn btn-quiet" href="/admin/tarifeler">Tarife güncelle</a>
            <a class="btn btn-quiet" href="/admin/araclar">Araç ekle</a>
            <a class="btn btn-quiet" href="/admin/yonlendirmeler">Yönlendirme</a>
            <a class="btn btn-quiet" href="/admin/sss">SSS ekle</a>
          </div>
        </section>
        <section class="admin-card">
          <h2>Trafik ve gelir</h2>
          <p class="stat-meta">${data.analyticsSet || data.adsenseSet ? 'Bağlantı var. Bu panel ziyaretçi veya gelir sayısı tutmuyor.' : 'Ziyaretçi ve reklam geliri, ölçüm veya AdSense bağlanınca görünür. Şu an ikisi de bağlı değil.'}</p>
          <div class="quick">
            <a class="btn" href="/admin/analitik">Analytics bağla</a>
            <a class="btn btn-quiet" href="/admin/reklam">AdSense bağla</a>
          </div>
        </section>
        <section class="admin-card">
          <h2>Zamanlanmış yayınlar</h2>
          ${scheduled.length ? scheduled.map((item) => `<div class="row"><div><a class="text-link" href="/admin/yazilar?id=${encodeURIComponent(item.id)}">${esc(item.title || item.id)}</a><p class="stat-meta">${esc(when(item.publishedAt))}</p></div></div>`).join('') : '<p class="stat-meta">İleri tarihli yazı yok. Ayrı bir zamanlayıcı yok: yayındaki yazı, İstanbul saati gelmeden sitede görünmez ve bunun için yeniden derlemek gerekir.</p>'}
          <a class="btn btn-quiet" href="/admin/yazilar">Yazılara git</a>
        </section>
        <section class="admin-card">
          <div class="row"><h2>Etkinlik günlüğü</h2><a class="text-link" href="/admin/gunluk">Tümü</a></div>
          ${activity.length ? activity.map((item) => `<div class="row"><div><span>${esc(actionName[item.action] || item.action)}</span><p class="stat-meta">${esc(item.target)} · ${esc(when(item.at))}</p></div></div>`).join('') : '<p class="stat-meta">Henüz kayıt yok. Parola buraya girilmez.</p>'}
        </section>
      </aside>
    </div>`,
  );
}

function categoryName(slug: string) {
  return categories.find(([id]) => id === slug)?.[1] || slug;
}

function localNow() {
  return istanbulStamp(new Date());
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

type ArticleRow = {
  id: string;
  title: string;
  type: string;
  category: string;
  author: string;
  draft: boolean;
  featured: boolean;
  updatedAt: string;
  description: string;
  hasSource: boolean;
  hasHero: boolean;
  heroAlt: string;
};

function seoScore(item: ArticleRow) {
  const title = item.title.trim().length;
  const description = item.description.trim().length;
  const checks = [title >= 12 && title <= 100, description >= 40 && description <= 180, item.hasSource];
  return { done: checks.filter(Boolean).length, total: checks.length };
}

function wordsOf(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function insertWrap(area: HTMLTextAreaElement, before: string, after = '') {
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const selected = area.value.slice(start, end) || 'metin';
  area.setRangeText(before + selected + after, start, end, 'end');
  area.dispatchEvent(new Event('input', { bubbles: true }));
  area.focus();
}

function insertLine(area: HTMLTextAreaElement, prefix: string) {
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const selected = area.value.slice(start, end) || 'metin';
  const next = selected.split('\n').map((line) => `${prefix}${line}`).join('\n');
  area.setRangeText(next, start, end, 'end');
  area.dispatchEvent(new Event('input', { bubbles: true }));
  area.focus();
}

async function renderArticles(root: HTMLElement) {
  const say = statusBox(root);
  const listed = await api('/api/admin/articles');
  if (!listed.ok) return say(errorsOf(listed.data), true);
  const params = new URLSearchParams(location.search);
  if (params.get('id') || params.get('yeni') === '1') return renderEditor(root, listed.data, say);
  return renderArticleTable(root, listed.data, say);
}

function renderArticleTable(root: HTMLElement, data: Json, say: (message: string, bad?: boolean) => void) {
  const articles = (data.articles as ArticleRow[]) || [];
  const authors = (data.authors as { slug: string; name: string }[]) || [];
  const authorName = (slug: string) => authors.find((item) => item.slug === slug)?.name || slug;
  const params = new URLSearchParams(location.search);
  const selected = new Set<string>();
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="writer-tools">
      <a class="btn" href="/admin/yazilar?yeni=1">Yeni yazı</a>
      <label>Ara<input id="article-filter" type="search" value="${esc(params.get('q') || '')}" placeholder="Başlık veya adres" /></label>
      <label>Durum<select id="filter-status">
        <option value="">Tümü</option>
        <option value="yayin">Yayında</option>
        <option value="taslak">Taslak</option>
      </select></label>
      <label>Tür<select id="filter-type">
        <option value="">Tümü</option>
        <option value="haber">Haber</option>
        <option value="rehber">Rehber</option>
      </select></label>
      <label>Kategori<select id="filter-category"><option value="">Tümü</option>${categories.map(([slug, name]) => `<option value="${slug}">${name}</option>`).join('')}</select></label>
      <label>Kadro<select id="filter-author"><option value="">Tümü</option>${authors.map((item) => `<option value="${esc(item.slug)}">${esc(item.name)}</option>`).join('')}</select></label>
      <label>Başlangıç<input id="filter-from" type="date" value="${esc(params.get('bas') || '')}" /></label>
      <label>Bitiş<input id="filter-to" type="date" value="${esc(params.get('bit') || '')}" /></label>
    </div>
    <p class="count" id="article-count"></p>
    <div class="table-wrap">
      <table class="data">
        <thead><tr>
          <th><input id="select-visible" type="checkbox" aria-label="Görünen yazıları seç" /></th>
          <th>Başlık</th><th>Kategori</th><th>Kadro</th><th>Durum</th><th>Güncelleme</th><th>SEO</th>
        </tr></thead>
        <tbody id="article-rows"></tbody>
      </table>
    </div>
    <div class="pager" id="article-pager"></div>
    <div class="panel-actions">
      <button class="btn btn-quiet" type="button" data-bulk="publish">Yayınla</button>
      <button class="btn btn-quiet" type="button" data-bulk="draft">Taslağa al</button>
      <label>Kategori<select id="bulk-category"><option value="">Seç</option>${categories.map(([slug, name]) => `<option value="${slug}">${name}</option>`).join('')}</select></label>
      <button class="btn btn-quiet" type="button" data-bulk="category">Kategori değiştir</button>
      <button class="btn btn-danger" type="button" data-bulk="delete">Sil</button>
    </div>`,
  );
  const status = root.querySelector<HTMLSelectElement>('#filter-status')!;
  const type = root.querySelector<HTMLSelectElement>('#filter-type')!;
  const category = root.querySelector<HTMLSelectElement>('#filter-category')!;
  const author = root.querySelector<HTMLSelectElement>('#filter-author')!;
  status.value = params.get('durum') || '';
  type.value = params.get('tur') || '';
  category.value = params.get('kategori') || '';
  author.value = params.get('yazar') || '';

  function queryOf() {
    const next = new URLSearchParams();
    const q = root.querySelector<HTMLInputElement>('#article-filter')?.value.trim() || '';
    const from = root.querySelector<HTMLInputElement>('#filter-from')?.value || '';
    const to = root.querySelector<HTMLInputElement>('#filter-to')?.value || '';
    if (q) next.set('q', q);
    if (status.value) next.set('durum', status.value);
    if (type.value) next.set('tur', type.value);
    if (category.value) next.set('kategori', category.value);
    if (author.value) next.set('yazar', author.value);
    if (from) next.set('bas', from);
    if (to) next.set('bit', to);
    const page = Number(new URLSearchParams(location.search).get('sayfa') || '1');
    if (page > 1) next.set('sayfa', String(page));
    return next;
  }

  function writeQuery(resetPage: boolean) {
    const next = queryOf();
    if (resetPage) next.delete('sayfa');
    history.replaceState(null, '', `${location.pathname}?${next.toString()}`.replace(/\?$/, ''));
    paint();
  }

  function visibleRows() {
    const q = (root.querySelector<HTMLInputElement>('#article-filter')?.value || '').toLocaleLowerCase('tr-TR');
    const from = root.querySelector<HTMLInputElement>('#filter-from')?.value || '';
    const to = root.querySelector<HTMLInputElement>('#filter-to')?.value || '';
    return articles.filter((item) => {
      if (status.value === 'taslak' && !item.draft) return false;
      if (status.value === 'yayin' && item.draft) return false;
      if (type.value && item.type !== type.value) return false;
      if (category.value && item.category !== category.value) return false;
      if (author.value && item.author !== author.value) return false;
      const day = item.updatedAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      const haystack = `${item.title} ${item.id}`.toLocaleLowerCase('tr-TR');
      return haystack.includes(q);
    });
  }

  function paint() {
    const rows = visibleRows();
    const pageSize = 20;
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    let page = Number(new URLSearchParams(location.search).get('sayfa') || '1');
    if (page > pageCount) page = pageCount;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);
    root.querySelector('#article-count')!.textContent = `${rows.length} yazı`;
    root.querySelector('#article-rows')!.innerHTML = slice.map((item) => {
      const score = seoScore(item);
      const chip = score.done === score.total ? 'is-ok' : score.done === 0 ? 'is-bad' : 'is-warn';
      return `<tr>
        <td><input type="checkbox" data-pick="${esc(item.id)}" aria-label="${esc(item.title)} seç" ${selected.has(item.id) ? 'checked' : ''} /></td>
        <td><a class="text-link" href="/admin/yazilar?id=${encodeURIComponent(item.id)}">${esc(item.title || item.id)}</a><div class="stat-meta">${esc(item.id)}</div></td>
        <td>${esc(categoryName(item.category))}</td>
        <td>${esc(authorName(item.author))}</td>
        <td><span class="chip ${item.draft ? 'is-warn' : 'is-ok'}">${item.draft ? 'Taslak' : 'Yayında'}</span></td>
        <td>${esc(shortDate(item.updatedAt))}</td>
        <td><span class="chip ${chip}">${score.done}/${score.total}</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="7">Bu süzgeçte yazı yok.</td></tr>';
    const pager = root.querySelector('#article-pager')!;
    pager.innerHTML = pageCount > 1
      ? Array.from({ length: pageCount }, (_, index) => `<button type="button" data-page="${index + 1}" ${index + 1 === page ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('')
      : '';
    const boxes = [...root.querySelectorAll<HTMLInputElement>('[data-pick]')];
    const selectAll = root.querySelector<HTMLInputElement>('#select-visible')!;
    selectAll.checked = boxes.length > 0 && boxes.every((box) => box.checked);
  }

  paint();
  root.querySelector('#article-filter')?.addEventListener('input', () => writeQuery(true));
  [status, type, category, author].forEach((input) => input.addEventListener('change', () => writeQuery(true)));
  root.querySelector('#filter-from')?.addEventListener('change', () => writeQuery(true));
  root.querySelector('#filter-to')?.addEventListener('change', () => writeQuery(true));
  root.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.id === 'select-visible') {
      root.querySelectorAll<HTMLInputElement>('[data-pick]').forEach((box) => {
        box.checked = target.checked;
        if (target.checked) selected.add(box.dataset.pick || '');
        else selected.delete(box.dataset.pick || '');
      });
    }
    if (target.dataset.pick) {
      if (target.checked) selected.add(target.dataset.pick);
      else selected.delete(target.dataset.pick);
    }
  });
  root.querySelector('#article-pager')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-page]');
    if (!button) return;
    const next = queryOf();
    next.set('sayfa', button.dataset.page || '1');
    history.replaceState(null, '', `${location.pathname}?${next.toString()}`);
    paint();
  });
  root.querySelector('.panel-actions')?.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-bulk]');
    if (!button) return;
    const ids = [...selected];
    if (!ids.length) return say('Önce yazı seç.', true);
    const action = button.dataset.bulk;
    if (action === 'delete' && !confirm(`${ids.length} yazı silinsin mi?`)) return;
    if (action === 'publish' && !confirm(`${ids.length} yazı yayına alınsın mı?`)) return;
    const bulkCategory = root.querySelector<HTMLSelectElement>('#bulk-category')?.value || '';
    if (action === 'category' && !bulkCategory) return say('Kategori seç.', true);
    const failures: string[] = [];
    for (const id of ids) {
      if (action === 'delete') {
        const result = await api(`/api/admin/articles?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!result.ok) failures.push(`${id}: ${errorsOf(result.data)}`);
        else {
          const index = articles.findIndex((item) => item.id === id);
          if (index >= 0) articles.splice(index, 1);
          selected.delete(id);
        }
      } else {
        const result = await api('/api/admin/articles', {
          method: 'PUT',
          body: JSON.stringify({
            id,
            patch: true,
            draft: action === 'draft' ? true : action === 'publish' ? false : undefined,
            category: action === 'category' ? bulkCategory : undefined,
          }),
        });
        if (!result.ok) failures.push(`${id}: ${errorsOf(result.data)}`);
        else {
          const row = articles.find((item) => item.id === id);
          if (row && action === 'draft') row.draft = true;
          if (row && action === 'publish') row.draft = false;
          if (row && action === 'category') row.category = bulkCategory;
        }
      }
    }
    paint();
    say(failures.length ? failures.join(' ') : 'Toplu işlem kaydedildi.', failures.length > 0);
  });
}

async function renderEditor(root: HTMLElement, data: Json, say: (message: string, bad?: boolean) => void) {
  const authors = (data.authors as { slug: string; name: string }[]) || [];
  const articles = (data.articles as ArticleRow[]) || [];
  const params = new URLSearchParams(location.search);
  const requested = params.get('id') || '';
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="editor-head">
      <a class="text-link" href="/admin/yazilar">← Yazılar</a>
      <strong id="editor-title">Yeni yazı</strong>
      <span class="chip is-warn" id="editor-state">Taslak</span>
      <span class="stat-meta" id="save-state">Kaydedilmedi</span>
      <span class="editor-actions">
        <a class="btn btn-quiet" id="view-article" href="/" hidden>Önizle</a>
        <button class="btn" type="button" id="publish-article">Yayınla</button>
      </span>
    </div>
    <form id="article-form" class="editor-layout">
      <div class="editor-main">
        <label>Başlık<input class="title-input" data-field="title" /></label>
        <div class="slug-row">
          <label>Tür<select data-field="type"><option value="haber">Haber</option><option value="rehber">Rehber</option></select></label>
          <label>Kısa adres<input data-field="slug" spellcheck="false" /></label>
        </div>
        <p class="count" id="article-id"></p>
        <div class="toolbar" role="toolbar" aria-label="Metin">
          <button class="tb" type="button" data-md="bold">Kalın</button>
          <button class="tb" type="button" data-md="italic">İtalik</button>
          <button class="tb" type="button" data-md="h2">H2</button>
          <button class="tb" type="button" data-md="h3">H3</button>
          <button class="tb" type="button" data-md="list">Liste</button>
          <button class="tb" type="button" data-md="quote">Alıntı</button>
          <button class="tb" type="button" data-md="link">Bağlantı</button>
          <button class="tb" type="button" data-md="table">Tablo</button>
          <button class="tb" type="button" data-md="faq">SSS</button>
          <button class="tb" type="button" data-md="car">Araç</button>
        </div>
        <label class="sr-only" for="article-body">Metin</label>
        <textarea id="article-body" data-field="body" rows="18"></textarea>
        <p class="stat-meta" id="read-meta"></p>
        <p class="admin-note">Kalın, başlık ve liste markdown olarak kaydedilir. SSS düğmesi yazı metnine soru ekler. Sitenin SSS şeması Sorular ekranındadır. Araç düğmesi hesaplayıcıya bağlantı koyar.</p>
      </div>
      <aside class="editor-side">
        <section class="admin-card">
          <h2>Yayın ayarları</h2>
          <label>Kategori<select data-field="category">${categories.map(([slug, name]) => `<option value="${slug}">${name}</option>`).join('')}</select></label>
          <label>Kadro<select data-field="author">${authors.map((item) => `<option value="${esc(item.slug)}">${esc(item.name)}</option>`).join('')}</select></label>
          <label>Yayın<input data-field="publishedAt" type="datetime-local" /></label>
          <label><span class="field-head">Güncelleme <button class="text-btn" type="button" id="touch-updated">Şimdi</button></span><input data-field="updatedAt" type="datetime-local" /></label>
          <div class="checks">
            <label><input data-field="featured" type="checkbox" /> Öne çıkan</label>
            <label><input data-field="breaking" type="checkbox" /> Son dakika</label>
            <label><input data-field="draft" type="checkbox" /> Taslak</label>
            <label><input data-field="sponsored" type="checkbox" /> Sponsorlu</label>
            <label><input data-field="affiliate" type="checkbox" /> Bağlı bağlantı</label>
          </div>
        </section>
        <section class="admin-card">
          <h2>Öne çıkan görsel</h2>
          <label>Dosya yolu<input data-field="heroImage" placeholder="/medya/dosya.jpg" spellcheck="false" /></label>
          <label>Alternatif metin<input data-field="heroAlt" /></label>
          <p class="stat-meta">Görsel varsa alternatif metin zorunlu. Yükleme Medya ekranında.</p>
        </section>
        <section class="admin-card">
          <h2>SEO</h2>
          <div class="serp" id="serp"></div>
          <label><span class="field-head">Açıklama <span class="count" id="description-count"></span></span><textarea data-field="description" rows="4"></textarea></label>
          <p class="stat-meta">İdeal aralık 120–160. Kayıt sınırı 40–180.</p>
          <div id="seo-checks"></div>
        </section>
        <section class="admin-card">
          <h2>Özet ve kaynak</h2>
          <label>Özet, satır başına bir madde<textarea data-field="summary" rows="4"></textarea></label>
          <label>Kaynaklar, satır başına ad | https://adres<textarea data-field="sources" rows="4" spellcheck="false"></textarea></label>
        </section>
        <div class="editor-bar">
          <button class="btn" type="submit">Kaydet</button>
          <button class="btn btn-danger" type="button" id="delete-article" hidden>Sil</button>
        </div>
      </aside>
    </form>`,
  );
  const form = root.querySelector<HTMLFormElement>('#article-form')!;
  const body = form.querySelector<HTMLTextAreaElement>('#article-body')!;
  let current = '';
  let slugManual = false;
  let dirty = false;
  const warnLeave = (event: BeforeUnloadEvent) => {
    if (!dirty) return;
    event.preventDefault();
  };
  window.addEventListener('beforeunload', warnLeave);

  function count() {
    const title = form.querySelector<HTMLInputElement>('[data-field="title"]')?.value || '';
    const description = form.querySelector<HTMLTextAreaElement>('[data-field="description"]')?.value || '';
    const slug = form.querySelector<HTMLInputElement>('[data-field="slug"]')?.value || '';
    const kind = form.querySelector<HTMLSelectElement>('[data-field="type"]')?.value || 'haber';
    const hero = form.querySelector<HTMLInputElement>('[data-field="heroImage"]')?.value.trim() || '';
    const alt = form.querySelector<HTMLInputElement>('[data-field="heroAlt"]')?.value.trim() || '';
    const draft = form.querySelector<HTMLInputElement>('[data-field="draft"]')?.checked;
    markCount(root.querySelector('#description-count')!, description.trim().length, 40, 180);
    root.querySelector('#editor-title')!.textContent = title.trim() || 'Yeni yazı';
    const state = root.querySelector('#editor-state')!;
    state.textContent = draft ? 'Taslak' : 'Yayında';
    state.className = `chip ${draft ? 'is-warn' : 'is-ok'}`;
    const words = wordsOf(body.value);
    const minutes = words ? Math.max(1, Math.round(words / 200)) : 0;
    root.querySelector('#read-meta')!.textContent = words ? `${words} kelime · ${minutes} dk okuma` : 'Metin yok';
    const path = `/${kind}/${slug || 'adres'}`;
    const internal = (body.value.match(/\]\(\//g) || []).length;
    root.querySelector('#serp')!.innerHTML = `<p class="stat-meta">benzinsiz.com${esc(path)}</p><p class="serp-title">${esc(title || 'Başlık')}</p><p class="stat-meta">${esc(description || 'Açıklama')}</p>`;
    const titleOk = title.trim().length >= 12 && title.trim().length <= 100;
    const descLen = description.trim().length;
    const descChip = descLen >= 120 && descLen <= 160 ? 'is-ok' : descLen >= 40 && descLen <= 180 ? 'is-warn' : 'is-bad';
    const descText = descLen >= 120 && descLen <= 160 ? 'Tamam' : descLen >= 40 && descLen <= 180 ? 'İdeal değil' : 'Eksik';
    const heroRow = hero
      ? `<div class="row"><span>Görsel alt metni</span><span class="chip ${alt.length >= 8 ? 'is-ok' : 'is-bad'}">${alt.length >= 8 ? 'Tamam' : 'Eksik'}</span></div>`
      : '<div class="row"><span>Görsel</span><span class="chip is-warn">Yok</span></div>';
    root.querySelector('#seo-checks')!.innerHTML = `<div class="row"><span>Başlık 12–100</span><span class="chip ${titleOk ? 'is-ok' : 'is-bad'}">${titleOk ? 'Tamam' : 'Eksik'}</span></div><div class="row"><span>Açıklama 120–160</span><span class="chip ${descChip}">${descText}</span></div><div class="row"><span>İç bağlantı</span><span class="chip ${internal >= 1 ? 'is-ok' : 'is-warn'}">${internal}</span></div>${heroRow}`;
  }

  function markDirty() {
    dirty = true;
    root.querySelector('#save-state')!.textContent = 'Kaydedilmedi';
  }

  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.dataset.field === 'title' && !current && !slugManual) {
      const slug = form.querySelector<HTMLInputElement>('[data-field="slug"]');
      if (slug) slug.value = slugify(target.value);
    }
    if (target instanceof HTMLInputElement && target.dataset.field === 'slug') slugManual = true;
    markDirty();
    count();
  });
  form.querySelector('.toolbar')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-md]');
    if (!button) return;
    const kind = button.dataset.md;
    if (kind === 'bold') insertWrap(body, '**', '**');
    if (kind === 'italic') insertWrap(body, '*', '*');
    if (kind === 'h2') insertLine(body, '## ');
    if (kind === 'h3') insertLine(body, '### ');
    if (kind === 'list') insertLine(body, '- ');
    if (kind === 'quote') insertLine(body, '> ');
    if (kind === 'link') insertWrap(body, '[', '](https://)');
    if (kind === 'table') insertWrap(body, '\n| Başlık | Başlık |\n| --- | --- |\n| ', ' | |\n');
    if (kind === 'faq') insertWrap(body, '\n## Sık sorulan sorular\n\n### ', '\nYanıt.\n');
    if (kind === 'car') insertWrap(body, '[Şarj maliyeti hesaplayıcı](/arac/hesaplayici)', '');
  });
  root.querySelector('#touch-updated')?.addEventListener('click', () => {
    const input = form.querySelector<HTMLInputElement>('[data-field="updatedAt"]');
    if (input) input.value = localNow();
    markDirty();
  });
  root.querySelector('#publish-article')?.addEventListener('click', () => {
    const draft = form.querySelector<HTMLInputElement>('[data-field="draft"]');
    if (draft) draft.checked = false;
    form.requestSubmit();
  });
  form.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  async function openArticle(id: string) {
    const result = await api(`/api/admin/articles?id=${encodeURIComponent(id)}`);
    if (!result.ok) return say(errorsOf(result.data), true);
    current = id;
    slugManual = true;
    const article = result.data;
    const [folder, slug] = id.split('/');
    fill(form, {
      ...article,
      type: folder,
      slug,
      publishedAt: localValue(article.publishedAt),
      updatedAt: localValue(article.updatedAt),
      summary: article.summary,
      sources: (article.sources as { name: string; url: string }[]).map((item) => (item.url ? `${item.name} | ${item.url}` : item.name)).join('\n'),
    });
    root.querySelector('#article-id')!.textContent = id;
    const view = root.querySelector<HTMLAnchorElement>('#view-article')!;
    view.hidden = Boolean(article.draft);
    view.href = `/${id}`;
    root.querySelector('#delete-article')?.removeAttribute('hidden');
    dirty = false;
    root.querySelector('#save-state')!.textContent = 'Kaydedildi';
    count();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const record = readForm(form);
    const creating = !current;
    const nextId = `${record.type}/${String(record.slug || '').trim()}`;
    let id = creating ? nextId : current;
    let rename = false;
    if (!creating && nextId !== current) {
      const accepted = confirm(`Adres ${current} yerine ${nextId} olsun mu? Eski adres yeni adrese 301 ile yönlendirilir. Yönlendirme sonraki derlemede geçer.`);
      if (!accepted) {
        const [folder, slug] = current.split('/');
        const type = form.querySelector<HTMLSelectElement>('[data-field="type"]');
        const slugInput = form.querySelector<HTMLInputElement>('[data-field="slug"]');
        if (type) type.value = folder;
        if (slugInput) slugInput.value = slug;
        id = current;
      } else {
        rename = true;
      }
    }
    const payload = {
      id,
      nextId: rename ? nextId : '',
      ...record,
      publishedAt: withOffset(String(record.publishedAt || '')),
      updatedAt: withOffset(String(record.updatedAt || '')),
      summary: String(record.summary || '').split('\n').map((item) => item.trim()).filter(Boolean),
      sources: String(record.sources || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [name, url] = line.split('|').map((part) => part.trim());
        return { name, url: url || '' };
      }),
    };
    root.querySelector('#save-state')!.textContent = 'Kaydediliyor';
    const result = await api('/api/admin/articles', { method: creating || rename ? (creating ? 'POST' : 'PUT') : 'PUT', body: JSON.stringify(payload) });
    if (!result.ok) {
      root.querySelector('#save-state')!.textContent = 'Hata';
      return say(errorsOf(result.data), true);
    }
    current = String(result.data.id || id);
    dirty = false;
    history.replaceState(null, '', `/admin/yazilar?id=${encodeURIComponent(current)}`);
    root.querySelector('#article-id')!.textContent = current;
    const view = root.querySelector<HTMLAnchorElement>('#view-article')!;
    view.hidden = Boolean(record.draft);
    view.href = `/${current}`;
    root.querySelector('#delete-article')?.removeAttribute('hidden');
    const moved = result.data.redirect as { from?: string; to?: string } | undefined;
    root.querySelector('#save-state')!.textContent = 'Kaydedildi';
    say(moved?.from ? `Yazı taşındı. ${moved.from} → ${moved.to} sonraki derlemede yönlenir.` : 'Yazı dosyaya kaydedildi.');
    count();
  });
  root.querySelector('#delete-article')?.addEventListener('click', async () => {
    if (!current || !confirm('Bu yazı silinsin mi?')) return;
    const result = await api(`/api/admin/articles?id=${encodeURIComponent(current)}`, { method: 'DELETE' });
    if (!result.ok) return say(errorsOf(result.data), true);
    dirty = false;
    location.href = '/admin/yazilar';
  });
  if (requested && articles.some((item) => item.id === requested)) openArticle(requested);
  else if (params.get('yeni') === '1') {
    const now = localNow();
    fill(form, { type: 'haber', draft: true, publishedAt: now, updatedAt: now, summary: '', sources: '', body: '', title: '', description: '', slug: '', heroImage: '', heroAlt: '' });
    root.querySelector('#article-id')!.textContent = 'Yeni adres, kayıttan sonra kalır.';
    count();
    form.querySelector<HTMLInputElement>('[data-field="title"]')?.focus();
  } else say('Yazı yok.', true);
}

async function renderPages(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/pages');
  if (!result.ok) return say(errorsOf(result.data), true);
  const rows = (result.data as unknown as { title: string; href: string; exists: boolean; description: string; length: number; file: string }[]) || [];
  root.insertAdjacentHTML(
    'beforeend',
    `<p class="admin-note">Bu sayfaların metni kaynak dosyada. Buradan yalnızca meta açıklamasının uzunluğu görünür. Hukuki metin yeniden yazılmaz. Açıklama Ayarlar içinden değişir.</p>
    <div class="table-wrap"><table class="data"><thead><tr><th>Sayfa</th><th>Dosya</th><th>Açıklama</th><th></th></tr></thead><tbody>
    ${rows.map((item) => `<tr><td>${item.exists ? `<a class="text-link" href="${esc(item.href)}">${esc(item.title)}</a>` : esc(item.title)}</td><td>${esc(item.file)}</td><td><span class="chip ${item.length >= 40 && item.length <= 180 ? 'is-ok' : 'is-bad'}">${item.length} karakter</span></td><td><a class="btn btn-quiet" href="/admin/ayarlar#ayar-meta">Açıklamayı düzenle</a></td></tr>`).join('')}
    </tbody></table></div>`,
  );
}

async function renderCategories(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/categories');
  if (!result.ok) return say(errorsOf(result.data), true);
  const rows = (result.data as unknown as { slug: string; name: string; description: string; count: number }[]) || [];
  root.insertAdjacentHTML(
    'beforeend',
    `<p class="admin-note">Sekiz kategori adresi içerik şemasında sabit. Yeni adres eklenemez, kullanılan adres silinemez. Açıklama 40–180 karakter.</p>
    <div class="stack">${rows.map((item) => `<form class="admin-card" data-slug="${esc(item.slug)}">
      <div class="row"><h2>${esc(item.name)}</h2><span class="stat-meta">${item.count} yazı · ${esc(item.slug)}</span></div>
      <label>Açıklama<textarea data-field="description" rows="3">${esc(item.description)}</textarea></label>
      <button class="btn" type="submit">Kaydet</button>
    </form>`).join('')}</div>`,
  );
  root.addEventListener('submit', async (event) => {
    const form = (event.target as HTMLElement).closest<HTMLFormElement>('form[data-slug]');
    if (!form) return;
    event.preventDefault();
    const description = form.querySelector<HTMLTextAreaElement>('[data-field="description"]')?.value.trim() || '';
    const saved = await api('/api/admin/categories', { method: 'PUT', body: JSON.stringify({ slug: form.dataset.slug, description }) });
    say(saved.ok ? 'Kategori açıklaması kaydedildi.' : errorsOf(saved.data), !saved.ok);
  });
}

async function renderMedia(root: HTMLElement) {
  const say = statusBox(root);
  const load = async () => {
    const result = await api('/api/admin/media');
    if (!result.ok) return say(errorsOf(result.data), true);
    const files = (result.data as unknown as { name: string; path: string; bytes: number; articles: string[] }[]) || [];
    const grid = root.querySelector('#media-grid');
    if (!grid) return;
    grid.innerHTML = files.length
      ? files.map((item) => `<article class="admin-card"><p><code>${esc(item.path)}</code></p><p class="stat-meta">${Math.ceil(item.bytes / 1024)} KB</p><p class="stat-meta">${item.articles.length ? `Kullanıldığı yazılar: ${esc(item.articles.join(', '))}` : 'Hiçbir yazıda geçmiyor.'}</p>${item.articles.length ? '' : `<button class="btn btn-danger" type="button" data-remove="${esc(item.name)}">Sil</button>`}</article>`).join('')
      : '<p class="admin-note">Görsel yok. jpg, png, webp veya avif yükle. En fazla 5 MB. SVG kabul edilmez.</p>';
  };
  root.insertAdjacentHTML(
    'beforeend',
    `<form id="media-upload" class="admin-card">
      <label>Görsel<input id="media-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
      <button class="btn" type="submit">Yükle</button>
    </form>
    <div class="media-grid" id="media-grid"></div>`,
  );
  await load();
  root.querySelector('#media-upload')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = root.querySelector<HTMLInputElement>('#media-file');
    const file = input?.files?.[0];
    if (!file) return say('Dosya seç.', true);
    if (file.size > 5 * 1024 * 1024) return say('Dosya 5 MB sınırını aşıyor.', true);
    const headers = new Headers();
    headers.set('x-benzinsiz-admin', '1');
    headers.set('content-type', 'application/octet-stream');
    const response = await fetch('/api/admin/media', { method: 'POST', headers, body: file });
    const payload = await response.json().catch(() => ({ error: 'Yanıt okunamadı.' }));
    if (!response.ok) return say(errorsOf(payload), true);
    if (input) input.value = '';
    say(`Yüklendi: ${payload.path}`);
    await load();
  });
  root.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button?.dataset.remove || !confirm('Bu görsel silinsin mi?')) return;
    const result = await api(`/api/admin/media?name=${encodeURIComponent(button.dataset.remove)}`, { method: 'DELETE' });
    if (!result.ok) return say(errorsOf(result.data), true);
    say('Görsel silindi.');
    await load();
  });
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
      <section class="admin-card"><h2>Değişiklik geçmişi</h2>${((data.history as { at: string; updatedAt: string }[]) || []).length ? (data.history as { at: string; updatedAt: string }[]).map((item) => `<div class="row"><span>${esc(item.updatedAt || 'Tarih yok')}</span><span class="stat-meta">${esc(item.at)}</span></div>`).join('') : '<p class="stat-meta">Henüz kayıtlı değişiklik yok. Kaydettikten sonra son fiyatlar burada durur.</p>'}</section>
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
  const rows = asRows<Json>(result.data);
  root.insertAdjacentHTML('beforeend', `<form id="car-form" class="stack panel-form"><p class="admin-note">Sayı varken kaynak adresi ve güncelleme tarihi zorunlu. Boş hücre sitede köşeli parantezde kalır. Adreste -vs- olmaz.</p><p class="count" id="car-count"></p><div id="cars" class="stack"></div><div class="panel-actions"><button class="btn btn-quiet" type="button" id="add-car">Araç ekle</button><button class="btn" type="submit">Kaydet</button></div></form>`);
  const host = root.querySelector<HTMLElement>('#cars')!;
  const draw = () => {
    root.querySelector('#car-count')!.textContent = `${rows.length} araç`;
    host.innerHTML = rows.map((row, index) => {
      const source = (row.source || {}) as Json;
      const priced = row.priceTry == null || row.priceTry === '' ? 'Fiyat kayıtlı değil' : money(row.priceTry, 'TL');
      const empty = [['priceTry', 'fiyat'], ['rangeKm', 'menzil'], ['batteryKwh', 'batarya'], ['dcKw', 'DC'], ['charge10to80Min', '10-80']].filter(([key]) => row[key] == null || row[key] === '').map(([, label]) => label);
      const preview = empty.length ? `Boş: ${empty.join(', ')}. Sitede köşeli parantez görünür.` : 'Sayısal alanlar dolu.';
      return record(String(row.name || 'Yeni araç'), `${row.brand ? `${String(row.brand)} · ` : ''}${priced}. ${preview}`, `
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
  const rows = asRows<Json>(result.data);
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
      ${field('Tanıtım', `bio-${index}`, String(row.bio || ''), 'textarea')}
      <div class="row"><button class="btn btn-quiet" type="button" data-move="up" data-index="${index}">Yukarı</button><button class="btn btn-quiet" type="button" data-move="down" data-index="${index}">Aşağı</button></div>`, `data-remove="${index}"`)).join('') || '<p class="admin-note">Kadro yok.</p>';
  };
  followTitle(host, 'name-', 'Yeni kadro');
  draw();
  root.querySelector('#add-author')?.addEventListener('click', () => {
    collectAuthors();
    rows.push({ slug: '', name: '', jobTitle: '', duty: '', expertise: [], bio: '' });
    draw();
  });
  host.addEventListener('click', (event) => {
    const move = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-move]');
    if (move) {
      collectAuthors();
      const index = Number(move.dataset.index);
      const next = move.dataset.move === 'up' ? index - 1 : index + 1;
      if (next < 0 || next >= rows.length) return;
      const [row] = rows.splice(index, 1);
      rows.splice(next, 0, row);
      draw();
      return;
    }
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
  const rows = asRows<{ from: string; to: string }>(result.data);
  root.insertAdjacentHTML('beforeend', `<form id="redirect-form" class="stack panel-form"><p class="admin-note">Adresler / ile başlar, / ile bitmez. Karşılaştırmanın ters yazılışı bunu beklemez; o yönlendirme kendiliğinden vardır. Değişiklik yeni derlemede devreye girer.</p><p class="count" id="redirect-count"></p><div id="redirects" class="stack"></div><div class="panel-actions"><button class="btn btn-quiet" type="button" id="add-redirect">Satır ekle</button><button class="btn btn-quiet" type="button" id="export-redirect">CSV indir</button><label class="btn btn-quiet">CSV yükle<input id="import-redirect" type="file" accept=".csv,text/csv" hidden /></label><button class="btn" type="submit">Kaydet</button></div></form>`);
  const host = root.querySelector<HTMLElement>('#redirects')!;
  const redirectValue = (name: string) => host.querySelector<HTMLInputElement>(`[data-field="${name}"]`)?.value.trim() ?? '';
  const collectRedirects = () => {
    if (!host.querySelector('[data-field]') && rows.length) return;
    const next = rows.map((_, index) => ({ from: redirectValue(`from-${index}`), to: redirectValue(`to-${index}`) }));
    rows.splice(0, rows.length, ...next);
  };
  const draw = () => {
    root.querySelector('#redirect-count')!.textContent = `${rows.length} yönlendirme`;
    host.innerHTML = rows.map((row, index) => {
      const chain = rows.some((item, itemIndex) => itemIndex !== index && item.from === row.to);
      return record('Yönlendirme', chain ? 'Zincir: hedef başka bir eski adres.' : '', `<div class="admin-grid cols-2">${field('Eski adres', `from-${index}`, row.from, 'text', '/eski-adres')}${field('Yeni adres', `to-${index}`, row.to, 'text', '/yeni-adres')}</div>`, `data-remove="${index}"`);
    }).join('') || '<p class="admin-note">Kayıtlı yönlendirme yok.</p>';
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
  root.querySelector('#export-redirect')?.addEventListener('click', () => {
    collectRedirects();
    const csv = ['eski,yeni', ...rows.map((row) => `${row.from},${row.to}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'yonlendirmeler.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  });
  root.querySelector('#import-redirect')?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const next = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('eski,')).map((line) => {
      const [from, to] = line.split(',').map((part) => part.trim());
      return { from, to };
    }).filter((row) => row.from && row.to);
    if (!next.length) return say('CSV satırı yok.', true);
    collectRedirects();
    const seen = new Set(rows.map((row) => row.from));
    let added = 0;
    for (const row of next) {
      if (seen.has(row.from)) continue;
      rows.push(row);
      seen.add(row.from);
      added += 1;
    }
    draw();
    say(added ? `${added} satır eklendi. Aynı eski adres atlandı. Kaydetmeden dosyaya yazılmaz.` : 'Yeni satır yok. Aynı eski adres atlandı.', added === 0);
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
  const rows = asRows<{ question: string; answer: string }>(result.data);
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
      return record(title.length > 90 ? `${title.slice(0, 87)}…` : title, '', `${field('Soru', `q-${index}`, row.question, 'textarea')}${field('Yanıt', `a-${index}`, row.answer, 'textarea')}<div class="row"><button class="btn btn-quiet" type="button" data-move="up" data-index="${index}">Yukarı</button><button class="btn btn-quiet" type="button" data-move="down" data-index="${index}">Aşağı</button></div>`, `data-remove="${index}"`);
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
    const move = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-move]');
    if (move) {
      collectFaq();
      const index = Number(move.dataset.index);
      const next = move.dataset.move === 'up' ? index - 1 : index + 1;
      if (next < 0 || next >= rows.length) return;
      const [row] = rows.splice(index, 1);
      rows.splice(next, 0, row);
      draw();
      return;
    }
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

async function renderMenu(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/navigation');
  if (!result.ok) return say(errorsOf(result.data), true);
  const data = result.data as { header: { href: string; label: string }[]; footer: { title: string; links: { href: string; label: string }[] }[] };
  const draw = () => {
    const host = root.querySelector('#menu-fields');
    if (!host) return;
    host.innerHTML = `<section class="admin-card"><h2>Üst menü</h2>${data.header.map((link, index) => `<div class="admin-grid cols-2">${field('Etiket', `h-label-${index}`, link.label)}${field('Adres', `h-href-${index}`, link.href, 'text', '/haber')}</div><div class="row"><button class="btn btn-quiet" type="button" data-up="header" data-index="${index}">Yukarı</button><button class="btn btn-quiet" type="button" data-down="header" data-index="${index}">Aşağı</button><button class="btn btn-danger" type="button" data-remove-header="${index}">Sil</button></div>`).join('')}<button class="btn btn-quiet" type="button" id="add-header">Bağlantı ekle</button></section>
    ${data.footer.map((column, columnIndex) => `<section class="admin-card"><h2>${esc(column.title)}</h2>${field('Sütun adı', `c-title-${columnIndex}`, column.title)}${column.links.map((link, index) => `<div class="admin-grid cols-2">${field('Etiket', `f-label-${columnIndex}-${index}`, link.label)}${field('Adres', `f-href-${columnIndex}-${index}`, link.href, 'text', '/hakkimizda')}</div><div class="row"><button class="btn btn-quiet" type="button" data-up="footer" data-column="${columnIndex}" data-index="${index}">Yukarı</button><button class="btn btn-quiet" type="button" data-down="footer" data-column="${columnIndex}" data-index="${index}">Aşağı</button><button class="btn btn-danger" type="button" data-remove-footer="${columnIndex}-${index}">Sil</button></div>`).join('')}<button class="btn btn-quiet" type="button" data-add-footer="${columnIndex}">Bağlantı ekle</button></section>`).join('')}`;
  };
  root.insertAdjacentHTML('beforeend', `<form id="menu-form" class="stack panel-form"><p class="admin-note">Üst şeritteki Hakkımızda, İletişim ve Künye burada değil. Adres / ile veya https ile başlar. Kayıt, açık olan dev sayfasında yenilenince görünür.</p><div id="menu-fields" class="stack"></div><div class="panel-actions"><button class="btn" type="submit">Kaydet</button></div></form>`);
  const value = (name: string) => root.querySelector<HTMLInputElement>(`[data-field="${name}"]`)?.value.trim() ?? '';
  const collect = () => {
    data.header = data.header.map((_, index) => ({ label: value(`h-label-${index}`), href: value(`h-href-${index}`) }));
    data.footer = data.footer.map((column, columnIndex) => ({
      title: value(`c-title-${columnIndex}`),
      links: column.links.map((_, index) => ({ label: value(`f-label-${columnIndex}-${index}`), href: value(`f-href-${columnIndex}-${index}`) })),
    }));
  };
  draw();
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.id === 'add-header') {
      collect();
      if (data.header.length >= 8) return say('Üst menü en fazla 8 bağlantı.', true);
      data.header.push({ label: '', href: '/' });
      draw();
      return;
    }
    const addFooter = target.closest<HTMLButtonElement>('[data-add-footer]');
    if (addFooter) {
      collect();
      const column = data.footer[Number(addFooter.dataset.addFooter)];
      if (column.links.length >= 12) return say('Sütun en fazla 12 bağlantı.', true);
      column.links.push({ label: '', href: '/' });
      draw();
      return;
    }
    const up = target.closest<HTMLButtonElement>('[data-up]');
    const down = target.closest<HTMLButtonElement>('[data-down]');
    const move = up || down;
    if (move) {
      collect();
      const index = Number(move.dataset.index);
      const next = up ? index - 1 : index + 1;
      if (move.dataset.up === 'header' || move.dataset.down === 'header') {
        if (next < 0 || next >= data.header.length) return;
        const [row] = data.header.splice(index, 1);
        data.header.splice(next, 0, row);
      } else {
        const links = data.footer[Number(move.dataset.column)].links;
        if (next < 0 || next >= links.length) return;
        const [row] = links.splice(index, 1);
        links.splice(next, 0, row);
      }
      draw();
      return;
    }
    const removeHeader = target.closest<HTMLButtonElement>('[data-remove-header]');
    if (removeHeader) {
      collect();
      if (data.header.length === 1) return say('Son üst bağlantı silinemez.', true);
      data.header.splice(Number(removeHeader.dataset.removeHeader), 1);
      draw();
      return;
    }
    const removeFooter = target.closest<HTMLButtonElement>('[data-remove-footer]');
    if (removeFooter) {
      collect();
      const [columnIndex, linkIndex] = String(removeFooter.dataset.removeFooter).split('-').map(Number);
      const links = data.footer[columnIndex].links;
      if (links.length === 1) return say('Sütunun son bağlantısı silinemez.', true);
      links.splice(linkIndex, 1);
      draw();
    }
  });
  root.querySelector('#menu-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    collect();
    const saved = await api('/api/admin/navigation', { method: 'PUT', body: JSON.stringify(data) });
    say(saved.ok ? 'Menü kaydedildi.' : errorsOf(saved.data), !saved.ok);
  });
}

async function renderSeo(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/seo');
  if (!result.ok) return say(errorsOf(result.data), true);
  const data = result.data as Json;
  const meta = (data.meta as { id: string; title: string; length: number }[]) || [];
  const ideal = (data.ideal as { id: string; title: string; length: number }[]) || [];
  const duplicates = (data.duplicates as { title: string; ids: string[] }[]) || [];
  const missing = (data.missingLinks as { id: string; path: string }[]) || [];
  const noSource = (data.noSource as { id: string; title: string }[]) || [];
  const list = (rows: string[], empty: string) => rows.length ? rows.map((row) => `<div class="row"><span>${row}</span></div>`).join('') : `<p class="stat-meta">${empty}</p>`;
  root.insertAdjacentHTML(
    'beforeend',
    `<section class="admin-card"><h2>robots.txt</h2><p class="stat-meta">${esc(data.robots)}</p><p class="stat-meta">Kanonik adres: ${esc(data.origin)}. Site haritası: ${esc(data.sitemap)}</p><p class="stat-meta">Yayında görünen yazı: ${esc(data.published)}</p></section>
    <section class="admin-card"><h2>Açıklaması geçersiz yazılar</h2>${list(meta.map((item) => `${esc(item.title)} · ${item.length} karakter`), '40–180 dışında açıklama yok.')}</section>
    <section class="admin-card"><h2>İdeal aralığın dışında</h2>${list(ideal.map((item) => `${esc(item.title)} · ${item.length} karakter`), '120–160 dışında kalan, yine de kayıt sınırına uyan yazı yok.')}</section>
    <section class="admin-card"><h2>Yinelenen başlık</h2>${list(duplicates.map((item) => `${esc(item.title)} · ${esc(item.ids.join(', '))}`), 'Aynı başlık yok.')}</section>
    <section class="admin-card"><h2>Yazı içi bağlantı</h2>${list(missing.map((item) => `${esc(item.id)} → ${esc(item.path)}`), 'Yazılardaki iç bağlantılar bilinen bir sayfaya gidiyor.')}</section>
    <section class="admin-card"><h2>Kaynak adresi olmayan yazı</h2>${list(noSource.map((item) => esc(item.title)), 'Kaynak adresi olmayan yazı yok.')}</section>`,
  );
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
      <p class="admin-note">Boş bağlantı alanı .env değerini kullanır. Dolu alan onu ezer. Şifre bu ekrana yazılmaz. Oturum 7 gündür. Bakım anahtarı yok. Tüzel unvan, adres, MERSİS, KEP ve telefon buradan girilmez. Yazı açıklaması Yazılar sekmesindedir.</p>
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
  const hash = location.hash.slice(1);
  if (/^[a-z0-9-]+$/i.test(hash)) document.getElementById(hash)?.scrollIntoView({ block: 'start' });
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

async function saveSettings(patch: Json) {
  const current = await api('/api/admin/settings');
  if (!current.ok) return current;
  const settings = (current.data.settings || {}) as Json;
  const payload: Json = { ...settings, ...patch };
  if (patch.adSlots) payload.adSlots = { ...((settings.adSlots || {}) as Json), ...(patch.adSlots as Json) };
  return api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
}

async function renderAds(root: HTMLElement) {
  const say = statusBox(root);
  const [result, overview] = await Promise.all([api('/api/admin/settings'), api('/api/admin/overview')]);
  if (!result.ok) return say(errorsOf(result.data), true);
  const settings = (result.data.settings || {}) as Json;
  const env = (result.data.env || {}) as Json;
  const slots = (settings.adSlots || {}) as Json;
  const envSlots = (env.adSlots || {}) as Json;
  const checks = (overview.ok ? overview.data.checks : []) as { label: string; ok: boolean; manual: boolean }[];
  const fields: [string, string, string][] = [
    ['homeTop', 'Ana sayfa üst', 'Geniş ekranda üst alan'],
    ['homeMid', 'Ana sayfa orta', 'Sayfa ortası'],
    ['early', 'Yazı başı', 'Yalnızca dar ekran'],
    ['mid', 'Yazı ortası', 'Yazı içi'],
    ['late', 'Yazı sonu', 'Yazı sonu'],
    ['sidebar', 'Kenar', 'Yalnızca geniş ekran'],
  ];
  root.insertAdjacentHTML(
    'beforeend',
    `<form id="ads-form" class="stack panel-form">
      <p class="admin-note">Reklam betiği çerez onayından önce yüklenmez. Otomatik reklam yok. Boş alan kutu çizmez. Gelir sayısı bu panelde tutulmuyor.</p>
      <section class="admin-card">
        <h2>Yayıncı kimliği</h2>
        ${field('AdSense yayıncı kimliği', 'adsensePublisherId', String(settings.adsensePublisherId || ''), 'text', 'pub-')}
        ${activeLine(String(settings.adsensePublisherId || ''), String(env.adsensePublisherId || ''))}
        <p class="field-hint">Biçim pub- ve rakam. ca-pub- yazma.</p>
        <h2>ads.txt</h2>
        <pre id="ads-preview" class="admin-note"></pre>
      </section>
      <section class="admin-card">
        <h2>Reklam alanları</h2>
        <div class="admin-grid cols-2">
          ${fields.map(([key, label, hint]) => `<div>${field(label, `slot-${key}`, String(slots[key] || ''), 'text', '1234567890')}<p class="field-hint">${esc(hint)}. 6–12 rakam.</p>${activeLine(String(slots[key] || ''), String(envSlots[key] || ''))}</div>`).join('')}
        </div>
      </section>
      ${checks.length ? `<section class="admin-card"><h2>Onay hazırlığı</h2>${checks.map((item) => `<div class="row"><span>${esc(item.label)}</span><span class="chip ${item.manual ? 'is-warn' : item.ok ? 'is-ok' : 'is-bad'}">${item.manual ? 'İşaretlenmedi' : item.ok ? 'Tamam' : 'Eksik'}</span></div>`).join('')}</section>` : ''}
      <div class="panel-actions"><button class="btn" type="submit">Kaydet</button></div>
    </form>`,
  );
  const form = root.querySelector<HTMLFormElement>('#ads-form')!;
  const preview = () => {
    const id = form.querySelector<HTMLInputElement>('[data-field="adsensePublisherId"]')?.value.trim() || String(env.adsensePublisherId || '');
    const box = root.querySelector('#ads-preview');
    if (!box) return;
    box.textContent = /^pub-\d+$/.test(id)
      ? `google.com, ${id}, DIRECT, f08c47fec0942fa0`
      : 'Geçerli pub- kimliği yok. ads.txt satırı üretilmez.';
  };
  preview();
  form.addEventListener('input', preview);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = (name: string) => form.querySelector<HTMLInputElement>(`[data-field="${name}"]`)?.value.trim() || '';
    const saved = await saveSettings({
      adsensePublisherId: value('adsensePublisherId'),
      adSlots: Object.fromEntries(fields.map(([key]) => [key, value(`slot-${key}`)])),
    });
    say(saved.ok ? 'Reklam ayarı kaydedildi.' : errorsOf(saved.data), !saved.ok);
  });
}

async function renderNewsletter(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/settings');
  if (!result.ok) return say(errorsOf(result.data), true);
  const settings = (result.data.settings || {}) as Json;
  const env = (result.data.env || {}) as Json;
  const endpoint = String(settings.newsletterEndpoint || '').trim() || String(env.newsletterEndpoint || '').trim();
  root.insertAdjacentHTML(
    'beforeend',
    `<form id="news-form" class="stack panel-form">
      <section class="admin-card">
        <h2>Aboneler</h2>
        <p class="stat-meta">${endpoint ? 'Servis adresi bağlı. Abone listesi bu panelde tutulmuyor. Kayıtlar sağlayıcıda.' : 'Bülten servisi bağlı değil. Adres kaydedilmedi. Abone sayısı yok.'}</p>
      </section>
      <section class="admin-card">
        <h2>Bağlantı</h2>
        ${field('Bülten adresi', 'newsletterEndpoint', String(settings.newsletterEndpoint || ''), 'url', 'https://')}
        ${activeLine(String(settings.newsletterEndpoint || ''), String(env.newsletterEndpoint || ''))}
        ${selectField('Biçim', 'newsletterFormat', String(settings.newsletterFormat || ''), [['', '.env değerini kullan'], ['json', 'JSON'], ['form', 'Form']])}
        <p class="field-hint">Form, servis yoksa adresi kaydetmez. Çift onay ve abonelikten çıkış sağlayıcıda durur.</p>
      </section>
      <div class="panel-actions"><button class="btn" type="submit">Kaydet</button></div>
    </form>`,
  );
  root.querySelector('#news-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const value = (name: string) => form.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${name}"]`)?.value.trim() || '';
    const saved = await saveSettings({ newsletterEndpoint: value('newsletterEndpoint'), newsletterFormat: value('newsletterFormat') });
    say(saved.ok ? 'Bülten ayarı kaydedildi.' : errorsOf(saved.data), !saved.ok);
  });
}

async function renderAnalytics(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/settings');
  if (!result.ok) return say(errorsOf(result.data), true);
  const settings = (result.data.settings || {}) as Json;
  const env = (result.data.env || {}) as Json;
  const mode = String(settings.analytics || '').trim() || String(env.analytics || '').trim();
  const connected = mode === 'ga4' || mode === 'plausible';
  root.insertAdjacentHTML(
    'beforeend',
    `<form id="analytics-form" class="stack panel-form">
      <section class="admin-card">
        <h2>Ziyaretçiler</h2>
        <p class="stat-meta">${connected ? 'Ölçüm bağlı. Bu panel ziyaretçi veya sayfa görüntüleme sayısı tutmuyor.' : 'Analytics bağlı değil. Ziyaretçi sayısı yok.'}</p>
      </section>
      <section class="admin-card">
        <h2>Bağlantı</h2>
        ${selectField('Ölçüm', 'analytics', String(settings.analytics || ''), [['', '.env değerini kullan'], ['plausible', 'Plausible'], ['ga4', 'GA4']])}
        ${activeLine(String(settings.analytics || ''), String(env.analytics || ''))}
        ${field('Plausible alan adı', 'plausibleDomain', String(settings.plausibleDomain || ''), 'text', 'benzinsiz.com')}
        ${field('Plausible betik adresi', 'plausibleSrc', String(settings.plausibleSrc || ''), 'url', 'https://')}
        ${field('GA4 kimliği', 'ga4Id', String(settings.ga4Id || ''), 'text', 'G-')}
        ${field('CMP betik adresi', 'cmpScriptUrl', String(settings.cmpScriptUrl || ''), 'url', 'https://')}
        <p class="field-hint">Betikler çerez onayından önce yüklenmez. Onay yoksa ölçüm çalışmaz.</p>
      </section>
      <div class="panel-actions"><button class="btn" type="submit">Kaydet</button></div>
    </form>`,
  );
  root.querySelector('#analytics-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const value = (name: string) => form.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${name}"]`)?.value.trim() || '';
    const saved = await saveSettings({
      analytics: value('analytics'),
      plausibleDomain: value('plausibleDomain'),
      plausibleSrc: value('plausibleSrc'),
      ga4Id: value('ga4Id'),
      cmpScriptUrl: value('cmpScriptUrl'),
    });
    say(saved.ok ? 'Ölçüm ayarı kaydedildi.' : errorsOf(saved.data), !saved.ok);
  });
}

async function renderUsers(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/account');
  if (!result.ok) return say(errorsOf(result.data), true);
  root.insertAdjacentHTML(
    'beforeend',
    `<section class="admin-card">
      <div class="row"><h2>Yönetici</h2><span class="chip is-ok">Tek hesap</span></div>
      <div class="row"><span>Oturum</span><span class="stat-meta">${esc(result.data.sessionDays)} gün</span></div>
      <div class="row"><span>Parola</span><span class="stat-meta">Formda yok. .env içindeki ADMIN_PASSWORD.</span></div>
      <div class="row"><span>Editör, Yazar, Görüntüleyici</span><span class="chip is-warn">Hesap yok</span></div>
      <p class="stat-meta">Kadrolar sitede görünen görevlerdir. Giriş hesabı yalnızca bu yöneticidir. Son yönetici silinemez.</p>
      <button class="btn btn-danger" type="button" id="remove-admin" disabled>Son yönetici silinemez</button>
    </section>`,
  );
}

async function renderBackups(root: HTMLElement) {
  const say = statusBox(root);
  root.insertAdjacentHTML(
    'beforeend',
    `<section class="admin-card">
      <h2>Dışa aktar</h2>
      <p class="stat-meta">Yazılar, tarifeler, araçlar, kadrolar, sorular, ayarlar, menü ve medya yolları iner. Parola dosyada yoktur. İndirme günlükte bir satır bırakır.</p>
      <button class="btn" type="button" id="download-backup">Yedek indir</button>
    </section>
    <section class="admin-card">
      <h2>Kuru kontrol</h2>
      <p class="stat-meta">Seçilen yedek sayılır. Dosyaya yazılmaz. Geri yükleme bu ekranda yok.</p>
      <label>Yedek dosyası<input id="backup-file" type="file" accept="application/json,.json" /></label>
      <p class="stat-meta" id="backup-report">Dosya seçilmedi.</p>
    </section>`,
  );
  root.querySelector('#download-backup')?.addEventListener('click', async () => {
    const result = await api('/api/admin/backup');
    if (!result.ok) return say(errorsOf(result.data), true);
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'benzinsiz-yedek.json';
    link.click();
    URL.revokeObjectURL(link.href);
    const articles = (result.data.articles as unknown[]) || [];
    say(`Yedek indi. ${articles.length} yazı. Parola yok.`);
  });
  root.querySelector('#backup-file')?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    const report = root.querySelector('#backup-report');
    if (!file || !report) return;
    try {
      const data = JSON.parse(await file.text()) as Json;
      const count = (value: unknown) => Array.isArray(value) ? value.length : 0;
      report.textContent = `Yazı ${count(data.articles)}, tarife satırı ${count((data.tariffs as Json | undefined)?.items)}, araç ${count(data.cars)}, kadro ${count(data.authors)}. Dosyaya yazılmadı.`;
    } catch {
      report.textContent = 'JSON okunamadı. Dosyaya yazılmadı.';
    }
  });
}

async function renderActivity(root: HTMLElement) {
  const say = statusBox(root);
  const result = await api('/api/admin/activity');
  if (!result.ok) return say(errorsOf(result.data), true);
  const names: Record<string, string> = {
    oturum: 'Oturum',
    yazi: 'Yazı',
    'yazi-durum': 'Yazı durumu',
    'yazi-sil': 'Yazı silindi',
    tarife: 'Tarife',
    arac: 'Araç',
    kadro: 'Kadro',
    yonlendirme: 'Yönlendirme',
    soru: 'Soru',
    kategori: 'Kategori',
    medya: 'Medya',
    'medya-sil': 'Medya silindi',
    menu: 'Menü',
    ayar: 'Ayar',
    yedek: 'Yedek',
  };
  const rows = (result.data.rows as { at: string; action: string; target: string }[]) || [];
  root.insertAdjacentHTML(
    'beforeend',
    `<p class="admin-note">Tek kullanıcı: ${esc(result.data.actor)}. Parola ve çerez değeri yazılmaz. Kayıtlar 90 gün durur.</p>
    <label>Ara<input id="activity-filter" type="search" placeholder="İşlem veya kayıt" /></label>
    <p class="count" id="activity-count"></p>
    <div class="table-wrap"><table class="data"><thead><tr><th>Zaman</th><th>Kim</th><th>İşlem</th><th>Kayıt</th></tr></thead><tbody id="activity-rows"></tbody></table></div>
    <div class="pager" id="activity-pager"></div>`,
  );
  let page = 1;
  const paint = () => {
    const query = (root.querySelector<HTMLInputElement>('#activity-filter')?.value || '').toLocaleLowerCase('tr-TR');
    const visible = rows.filter((row) => `${names[row.action] || row.action} ${row.target}`.toLocaleLowerCase('tr-TR').includes(query));
    const pageSize = 20;
    const pages = Math.max(1, Math.ceil(visible.length / pageSize));
    if (page > pages) page = pages;
    const slice = visible.slice((page - 1) * pageSize, page * pageSize);
    root.querySelector('#activity-count')!.textContent = visible.length ? `${visible.length} kayıt` : 'Henüz kayıt yok.';
    root.querySelector('#activity-rows')!.innerHTML = slice.length
      ? slice.map((row) => `<tr><td>${esc(new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(row.at)))}</td><td>Yönetici</td><td>${esc(names[row.action] || row.action)}</td><td>${esc(row.target)}</td></tr>`).join('')
      : '<tr><td colspan="4">Henüz kayıt yok.</td></tr>';
    const pager = root.querySelector('#activity-pager')!;
    pager.innerHTML = pages > 1
      ? Array.from({ length: pages }, (_, index) => `<button type="button" data-page="${index + 1}" ${index + 1 === page ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('')
      : '';
  };
  paint();
  root.querySelector('#activity-filter')?.addEventListener('input', () => {
    page = 1;
    paint();
  });
  root.querySelector('#activity-pager')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-page]');
    if (!button) return;
    page = Number(button.dataset.page || '1');
    paint();
  });
}

function bootShell() {
  const nav = document.querySelector<HTMLElement>('.admin-nav');
  const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
  const backdrop = document.querySelector<HTMLElement>('.nav-backdrop');
  const setOpen = (open: boolean) => {
    nav?.classList.toggle('is-open', open);
    backdrop?.classList.toggle('is-open', open);
    if (backdrop) backdrop.hidden = !open;
    toggle?.setAttribute('aria-expanded', String(open));
  };
  toggle?.addEventListener('click', () => setOpen(!nav?.classList.contains('is-open')));
  backdrop?.addEventListener('click', () => setOpen(false));
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  const input = document.querySelector<HTMLInputElement>('#admin-q');
  const hits = document.querySelector<HTMLElement>('#admin-hits');
  const pages = [...document.querySelectorAll<HTMLAnchorElement>('.admin-nav a')].map((link) => ({
    title: link.querySelector('span')?.textContent?.trim() || link.textContent?.trim() || '',
    href: link.getAttribute('href') || '/admin',
  }));
  let articles: { title: string; href: string }[] = [];
  const paintHits = () => {
    if (!hits || !input) return;
    const query = input.value.trim().toLocaleLowerCase('tr-TR');
    if (!query) {
      hits.hidden = true;
      hits.innerHTML = '';
      return;
    }
    const found = [...pages, ...articles].filter((item) => item.title.toLocaleLowerCase('tr-TR').includes(query)).slice(0, 8);
    hits.hidden = found.length === 0;
    hits.innerHTML = found.map((item) => `<a href="${esc(item.href)}">${esc(item.title)}</a>`).join('');
  };
  input?.addEventListener('input', paintHits);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      if (hits && !hits.hidden) {
        hits.hidden = true;
        hits.innerHTML = '';
        if (input) input.value = '';
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      input?.focus();
    }
  });
  if (document.body.dataset.panel !== 'giris') {
    api('/api/admin/overview').then((result) => {
      if (!result.ok) return;
      document.querySelectorAll<HTMLElement>('[data-badge]').forEach((node) => {
        const key = node.dataset.badge || '';
        if (result.data[key] != null) node.textContent = String(result.data[key]);
      });
      const found = result.data.search;
      articles = Array.isArray(found)
        ? found.flatMap((item) => {
            if (!item || typeof item !== 'object') return [];
            const row = item as { title?: string; href?: string; id?: string };
            const title = String(row.title || '');
            if (!title) return [];
            const href = row.href || (row.id ? `/admin/yazilar?id=${encodeURIComponent(row.id)}` : '');
            return href ? [{ title, href }] : [];
          })
        : [];
    });
  }
}

export function bootAdmin() {
  bootShell();
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
      sayfalar: renderPages,
      kategoriler: renderCategories,
      medya: renderMedia,
      tarifeler: renderTariffs,
      araclar: renderCars,
      yazarlar: renderAuthors,
      yonlendirmeler: renderRedirects,
      sss: renderFaq,
      menu: renderMenu,
      seo: renderSeo,
      reklam: renderAds,
      bulten: renderNewsletter,
      analitik: renderAnalytics,
      kullanicilar: renderUsers,
      yedekler: renderBackups,
      gunluk: renderActivity,
      ayarlar: renderSettings,
    };
    screens[panel]?.(root);
  });
}
