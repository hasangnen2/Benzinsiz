import { pageMeta, siteName } from '../lib/site';

export function GET() {
  const body = {
    name: siteName,
    short_name: siteName,
    description: pageMeta('home'),
    lang: 'tr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F1E8',
    theme_color: '#0A1F3C',
    categories: ['news', 'magazines'],
    icons: [
      { src: '/favicon.svg', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/logo-112.png', sizes: '112x112', type: 'image/png', purpose: 'any' },
    ],
    id: '/',
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
}
