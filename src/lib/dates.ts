const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function part(date: Date, type: Intl.DateTimeFormatPartTypes) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return parts.find((item) => item.type === type)?.value ?? '00';
}

export function istanbulIso(date: Date) {
  return `${part(date, 'year')}-${part(date, 'month')}-${part(date, 'day')}T${part(date, 'hour')}:${part(date, 'minute')}:${part(date, 'second')}+03:00`;
}

export function istanbulDay(date: Date) {
  return `${part(date, 'year')}-${part(date, 'month')}-${part(date, 'day')}`;
}

export function formatDate(date: Date) {
  return dateFormat.format(date);
}

export function formatWeekday(date: Date) {
  const weekday = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    weekday: 'long',
  }).format(date);
  const label = weekday.charAt(0).toLocaleUpperCase('tr-TR') + weekday.slice(1);
  return `${label}, ${dateFormat.format(date)}`;
}

export function formatClock(date: Date) {
  return timeFormat.format(date);
}

export function formatNewsStamp(date: Date, now = new Date()) {
  const day = istanbulDay(date);
  const today = istanbulDay(now);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (day === today) return formatClock(date);
  if (day === istanbulDay(yesterdayDate)) return 'Dün';
  return formatDate(date);
}

export function withinLastHours(date: Date, hours: number, now = new Date()) {
  const age = now.getTime() - date.getTime();
  return age >= 0 && age <= hours * 60 * 60 * 1000;
}

export function copyrightYear(now = new Date()) {
  return part(now, 'year');
}
