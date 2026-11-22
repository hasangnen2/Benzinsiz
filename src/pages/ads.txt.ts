import { publisherId } from '../lib/site';

export function GET() {
  const id = publisherId();
  const body = id
    ? `google.com, ${id}, DIRECT, f08c47fec0942fa0\n`
    : '# PUBLIC_ADSENSE_PUBLISHER_ID tanımlı değil. Geçerli pub- kimliği verilince satır üretilir.\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
