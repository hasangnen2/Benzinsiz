import fs from 'node:fs';
import path from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { authorBySlug, categoryBySlug, typeLabel } from './site';
import { readingMinutes } from './markdown';

export const PAGE_SIZE = 12;
export type ArticleEntry = CollectionEntry<'articles'>;

export interface ArticleModel {
  id: string;
  slug: string;
  href: string;
  title: string;
  description: string;
  type: ArticleEntry['data']['type'];
  typeLabel: string;
  categorySlug: string;
  categoryName: string;
  authorSlug: string;
  authorName: string;
  publishedAt: Date;
  updatedAt: Date;
  sources: ArticleEntry['data']['sources'];
  summary: string[];
  featured: boolean;
  breaking: boolean;
  sponsored: boolean;
  affiliate: boolean;
  draft: boolean;
  minutes: number;
  body: string;
  heroImage: ArticleEntry['data']['heroImage'];
  heroAlt: string | undefined;
  heroCredit: string | undefined;
  heroCreditUrl: string | undefined;
}

export function articleSlug(id: string) {
  return id.split('/').pop() ?? id;
}

export function articleHref(type: string, slug: string) {
  if (type === 'haber') return `/haber/${slug}`;
  if (type === 'rehber') return `/rehber/${slug}`;
  return `/karsilastir/${slug}`;
}

function entryBody(entry: ArticleEntry) {
  const direct = (entry as ArticleEntry & { body?: string }).body;
  if (direct) return direct;
  const filePath = (entry as ArticleEntry & { filePath?: string }).filePath;
  if (!filePath) return '';
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const raw = fs.readFileSync(absolute, 'utf8');
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) return raw.slice(end + 4).replace(/^\r?\n/, '');
  }
  return raw;
}

export function toModel(entry: ArticleEntry): ArticleModel {
  const slug = articleSlug(entry.id);
  const author = authorBySlug(entry.data.author);
  const category = categoryBySlug(entry.data.category);
  if (!author) throw new Error(`Yazar yok: ${entry.data.author}`);
  if (!category) throw new Error(`Kategori yok: ${entry.data.category}`);
  const body = entryBody(entry);
  return {
    id: entry.id,
    slug,
    href: articleHref(entry.data.type, slug),
    title: entry.data.title,
    description: entry.data.description,
    type: entry.data.type,
    typeLabel: typeLabel(entry.data.type),
    categorySlug: category.slug,
    categoryName: category.name,
    authorSlug: author.slug,
    authorName: author.name,
    publishedAt: entry.data.publishedAt,
    updatedAt: entry.data.updatedAt,
    sources: entry.data.sources,
    summary: entry.data.summary,
    featured: entry.data.featured,
    breaking: entry.data.breaking,
    sponsored: entry.data.sponsored,
    affiliate: entry.data.affiliate,
    draft: entry.data.draft,
    minutes: readingMinutes(body),
    body,
    heroImage: entry.data.heroImage,
    heroAlt: entry.data.heroAlt,
    heroCredit: entry.data.heroCredit,
    heroCreditUrl: entry.data.heroCreditUrl,
  };
}

export async function loadArticles() {
  const now = Date.now();
  const entries = await getCollection('articles');
  return entries
    .map(toModel)
    .filter((item) => !item.draft && item.type !== 'karsilastirma' && item.publishedAt.getTime() <= now)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export function slicePage<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safe = Math.min(Math.max(page, 1), totalPages);
  const start = (safe - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    page: safe,
    totalPages,
    total: items.length,
  };
}

export function relatedArticles(all: ArticleModel[], current: ArticleModel, limit = 3) {
  const sameCategory = all.filter((item) => item.href !== current.href && item.categorySlug === current.categorySlug);
  const sameType = all.filter(
    (item) => item.href !== current.href && item.type === current.type && !sameCategory.includes(item),
  );
  const rest = all.filter((item) => item.href !== current.href && !sameCategory.includes(item) && !sameType.includes(item));
  return [...sameCategory, ...sameType, ...rest].slice(0, limit);
}

export function nextStep(article: ArticleModel) {
  if (article.categorySlug === 'sarj') {
    return {
      href: '/rehber/elektrikli-arac-almadan-once',
      title: 'Satın alma kontrolüne geç',
      text: 'Şarj başlığını, karar vermeden önceki on kontrolün içine yerleştir.',
    };
  }
  if (article.categorySlug === 'alim') {
    return {
      href: '/karsilastir',
      title: 'Modelleri yan yana koy',
      text: 'Kayıtlı araçların fiyat, menzil ve şarj satırlarını aç. Boş hücre köşeli parantezdir.',
    };
  }
  return {
    href: '/arac/hesaplayici',
    title: 'Şarj maliyetini hesapla',
      text: 'Ev tarifesi resmi tablodan gelir. İstasyon fiyatını sen yazarsın.',
  };
}
