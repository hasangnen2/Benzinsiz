import authorsJson from '../data/authors.json';
import settingsJson from '../data/settings.json';
import { categories, categoryBySlug, type CategorySlug } from '../data/categories';

export const settings = settingsJson;
export const siteName = settings.siteName || 'Benzinsiz';
export const slogan = settings.slogan || 'Elektrikli araç dünyasında güvenilir kaynak';
export const locale = 'tr-TR';
export const countryCode = 'TR';
export const countryName = 'Türkiye';

function pick(file: string, env?: string) {
  const left = (file || '').trim();
  return left || (env || '').trim();
}

export function pageMeta(key: keyof typeof settings.meta) {
  return settings.meta[key];
}
export const defaultOg = '/og-default.png';
export const logoPath = '/logo-112.png';

export { categories, categoryBySlug };
export type { CategorySlug };

export interface Author {
  slug: string;
  name: string;
  jobTitle: string;
  duty: string;
  expertise: string[];
  bio: string;
}

export const authors = authorsJson as Author[];

export function authorBySlug(slug: string) {
  return authors.find((item) => item.slug === slug);
}

export function siteOrigin() {
  const value = pick(settings.siteUrl, import.meta.env.SITE || import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321');
  return value.replace(/\/$/, '') || 'http://localhost:4321';
}

export function absUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = siteOrigin();
  if (path === '/' || path === '') return `${origin}/`;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export function contactEmail() {
  const email = pick(settings.contactEmail, import.meta.env.PUBLIC_CONTACT_EMAIL);
  if (!email || email.endsWith('.example') || !email.includes('@')) return null;
  return email;
}

export function publisherId() {
  const id = pick(settings.adsensePublisherId, import.meta.env.PUBLIC_ADSENSE_PUBLISHER_ID);
  return /^pub-\d+$/.test(id) ? id : '';
}

export const adSlotIds = {
  homeTop: pick(settings.adSlots.homeTop, import.meta.env.PUBLIC_ADSENSE_SLOT_HOME_TOP),
  homeMid: pick(settings.adSlots.homeMid, import.meta.env.PUBLIC_ADSENSE_SLOT_HOME_MID),
  early: pick(settings.adSlots.early, import.meta.env.PUBLIC_ADSENSE_SLOT_ARTICLE_EARLY),
  mid: pick(settings.adSlots.mid, import.meta.env.PUBLIC_ADSENSE_SLOT_ARTICLE_MID),
  late: pick(settings.adSlots.late, import.meta.env.PUBLIC_ADSENSE_SLOT_ARTICLE_LATE),
  sidebar: pick(settings.adSlots.sidebar, import.meta.env.PUBLIC_ADSENSE_SLOT_SIDEBAR),
};

export function integrations() {
  const analytics = pick(settings.analytics, import.meta.env.PUBLIC_ANALYTICS);
  const format = pick(settings.newsletterFormat, import.meta.env.PUBLIC_NEWSLETTER_FORMAT);
  return {
    analytics: analytics === 'plausible' || analytics === 'ga4' ? analytics : '',
    plausibleDomain: pick(settings.plausibleDomain, import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN),
    plausibleSrc: pick(settings.plausibleSrc, import.meta.env.PUBLIC_PLAUSIBLE_SRC) || 'https://plausible.io/js/script.js',
    ga4Id: pick(settings.ga4Id, import.meta.env.PUBLIC_GA4_ID),
    cmp: pick(settings.cmpScriptUrl, import.meta.env.PUBLIC_CMP_SCRIPT_URL),
    newsletterEndpoint: pick(settings.newsletterEndpoint, import.meta.env.PUBLIC_NEWSLETTER_ENDPOINT),
    newsletterFormat: format === 'form' ? 'form' : 'json',
    contactEndpoint: pick(settings.contactEndpoint, import.meta.env.PUBLIC_CONTACT_ENDPOINT),
  };
}

export const nav = [
  { href: '/haber', label: 'Haberler' },
  { href: '/rehber', label: 'Rehberler' },
  { href: '/kategori/inceleme', label: 'İncelemeler' },
  { href: '/karsilastir', label: 'Karşılaştırma' },
  { href: '/kategori/sarj', label: 'Şarj' },
  { href: '/arac', label: 'Araçlar' },
] as const;

export function typeLabel(type: string) {
  if (type === 'haber') return 'Haber';
  if (type === 'rehber') return 'Rehber';
  return 'Karşılaştırma';
}

export function coverTone(category: string) {
  if (category === 'maliyet' || category === 'bakim') return 'gold';
  if (category === 'menzil' || category === 'alim' || category === 'inceleme') return 'petrol';
  return 'navy';
}

export function isActive(href: string, path: string) {
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}
