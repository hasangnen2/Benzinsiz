import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectRedirects } from './redirects.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const redirects = collectRedirects();

const lines = [
  '# Benzinsiz kalıcı yönlendirmeler. Hepsi 301.',
  ...redirects.map((item) => `${item.from} ${item.to} 301`),
  '',
];
writeFileSync(join(root, 'public', '_redirects'), lines.join('\n'), 'utf8');

const netlify = [
  '# Üretilen dosya. force = true: statik meta-refresh HTML dosyası 301’i gölgelemez.',
  ...redirects.flatMap((item) => [
    '[[redirects]]',
    `  from = "${item.from}"`,
    `  to = "${item.to}"`,
    '  status = 301',
    '  force = true',
    '',
  ]),
].join('\n');
writeFileSync(join(root, 'public', 'netlify.toml'), netlify, 'utf8');

const vercel = {
  redirects: redirects.map((item) => ({
    source: item.from,
    destination: item.to,
    permanent: true,
  })),
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};
writeFileSync(join(root, 'public', 'vercel.json'), `${JSON.stringify(vercel, null, 2)}\n`, 'utf8');
