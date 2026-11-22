import carsJson from '../data/cars.json';
import { formatDate } from './dates';

export interface CarSource {
  name: string | null;
  url: string | null;
}

export interface Car {
  id: string;
  slug: string;
  name: string;
  brand: string;
  priceTry: number | null;
  rangeKm: number | null;
  batteryKwh: number | null;
  dcKw: number | null;
  charge10to80Min: number | null;
  warranty: string | null;
  source: CarSource;
  updatedAt: string | null;
}

export const cars = carsJson as Car[];

const numberFormat = new Intl.NumberFormat('tr-TR');

export function formatTry(value: number) {
  return `${numberFormat.format(value)} TL`;
}
export function formatKm(value: number) {
  return `${numberFormat.format(value)} km`;
}
export function formatKwh(value: number) {
  return `${numberFormat.format(value)} kWh`;
}
export function formatKw(value: number) {
  return `${numberFormat.format(value)} kW`;
}
export function formatMinutes(value: number) {
  return `${numberFormat.format(value)} dk`;
}

export interface ComparisonPair {
  a: Car;
  b: Car;
  slug: string;
  href: string;
  title: string;
  description: string;
}

export function allComparisons(list = cars): ComparisonPair[] {
  const sorted = [...list].sort((a, b) => a.slug.localeCompare(b.slug, 'tr'));
  const pairs: ComparisonPair[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i];
      const b = sorted[j];
      const slug = `${a.slug}-vs-${b.slug}`;
      pairs.push({
        a,
        b,
        slug,
        href: `/karsilastir/${slug}`,
        title: `${a.name} ve ${b.name} karşılaştırması`,
        description: 'Fiyat, menzil, batarya, DC güç, 10-80% süre ve garanti. Boş alan köşeli parantezdir; rakam üretilmez.',
      });
    }
  }
  return pairs;
}

export function comparisonUpdated(pair: ComparisonPair) {
  if (!pair.a.updatedAt || !pair.b.updatedAt) return null;
  const a = new Date(pair.a.updatedAt);
  const b = new Date(pair.b.updatedAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return a < b ? a : b;
}

type MetricKey = 'rangeKm' | 'priceTry' | 'dcKw' | 'charge10to80Min';

const metrics: { key: MetricKey; label: string; better: 'high' | 'low'; format: (value: number) => string }[] = [
  { key: 'rangeKm', label: 'Menzil', better: 'high', format: formatKm },
  { key: 'priceTry', label: 'Fiyat', better: 'low', format: formatTry },
  { key: 'dcKw', label: 'DC şarj gücü', better: 'high', format: formatKw },
  { key: 'charge10to80Min', label: '10-80% süre', better: 'low', format: formatMinutes },
];

export function situationFor(subject: Car, other: Car) {
  const notes: string[] = [];
  for (const metric of metrics) {
    const left = subject[metric.key];
    const right = other[metric.key];
    if (left == null || right == null) continue;
    const subjectText = metric.format(left);
    const otherText = metric.format(right);
    if (left === right) {
      notes.push(`${metric.label} ölçütünde iki kayıt aynı: ${subjectText}.`);
      continue;
    }
    const subjectAhead = metric.better === 'high' ? left > right : left < right;
    notes.push(
      subjectAhead
        ? `${metric.label} ölçütünde kaynaklı değer ${metric.better === 'high' ? 'daha yüksek' : 'daha düşük'}: ${subjectText} (${other.name}: ${otherText}).`
        : `${metric.label} ölçütünde geride: ${subjectText} (${other.name}: ${otherText}).`,
    );
  }
  if (subject.warranty && other.warranty) {
    notes.push(`Garanti metni: “${subject.warranty}”. Karşı kayıt: “${other.warranty}”.`);
  }
  if (!notes.length) {
    notes.push('[Ölçüt verisi girilince bu sütun, kaynaklı değere göre doldurulur.]');
  }
  return notes;
}

export function hasComparableData(car: Car) {
  return metrics.some((metric) => car[metric.key] != null) || Boolean(car.warranty);
}

export function updatedLabel(pair: ComparisonPair) {
  const date = comparisonUpdated(pair);
  return date ? formatDate(date) : null;
}
