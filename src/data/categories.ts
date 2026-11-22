import settings from './settings.json';

const catalog = [
  {
    slug: 'sarj',
    name: 'Şarj',
    description: 'Evde ve istasyonda şarj, tarife okuma ve kurulum. Birim fiyat kaynakta yoksa yazılmaz.',
  },
  {
    slug: 'menzil',
    name: 'Menzil',
    description: 'Menzil cümlesi, kış etkisi ve yol planı. Üretici verisi girilmeden kilometre yazılmaz.',
  },
  {
    slug: 'maliyet',
    name: 'Maliyet',
    description: 'Şarj, bakım ve sigorta kalemleri. Tutar, fatura veya resmi tarife olmadan tabloya girmez.',
  },
  {
    slug: 'alim',
    name: 'Satın alma',
    description: 'Karar vermeden önce kontrol edilecek başlıklar. Tek bir broşür cümlesi yeterli sayılmaz.',
  },
  {
    slug: 'modeller',
    name: 'Modeller',
    description: 'Model duyuruları ve teknik satırlar. Ölçüt, kaynak adresiyle birlikte durur.',
  },
  {
    slug: 'mevzuat',
    name: 'Mevzuat',
    description: 'Resmi duyuru ve düzenleme notları. Hüküm, metnin kendisinden okunur.',
  },
  {
    slug: 'inceleme',
    name: 'İncelemeler',
    description: 'Kaynaklı model incelemeleri. Ölçüm yoksa o satır boş kalır.',
  },
  {
    slug: 'bakim',
    name: 'Bakım',
    description: 'Batarya ve periyodik bakım. Periyot ve ücret, üretici veya servis kaydıyla yazılır.',
  },
] as const;

export type CategorySlug = (typeof catalog)[number]['slug'];

export const categories = catalog.map((item) => ({
  ...item,
  description: settings.categories[item.slug] || item.description,
}));

export function categoryBySlug(slug: string) {
  return categories.find((item) => item.slug === slug);
}
