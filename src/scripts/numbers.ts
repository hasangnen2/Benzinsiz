export function parseNum(raw: string) {
  const value = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

export function parseOptional(raw: string): number | null | 'invalid' {
  if (raw.trim() === '') return null;
  const value = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(value)) return 'invalid';
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 'invalid';
  return number;
}

const money = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

export function formatMoney(value: number) {
  return `${money.format(value)} TL`;
}

const rate = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 });

export function formatRate(value: number) {
  return rate.format(value);
}

export function formatCount(value: number) {
  return count.format(value);
}
