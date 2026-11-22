import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { astroRedirectMap } from './scripts/redirects.mjs';
import { buildSeoIndex } from './scripts/lastmod.mjs';
import { adminPlugin } from './src/admin/plugin.mjs';

function loadDotEnv() {
  try {
    const text = readFileSync(new URL('./.env', import.meta.url), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]] != null) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .env yoksa ortam değişkeni yeter */
  }
}

loadDotEnv();

const site = (process.env.PUBLIC_SITE_URL || 'http://localhost:4321').replace(/\/$/, '');
if (site.includes('localhost')) {
  console.warn('PUBLIC_SITE_URL localhost. Yayında kanonik adres için üretim değerini verin.');
}

const seo = buildSeoIndex();

export default defineConfig({
  site,
  trailingSlash: 'never',
  redirects: astroRedirectMap(),
  integrations: [
    mdx(),
    sitemap({
      filter(page) {
        const path = new URL(page).pathname.replace(/\/$/, '') || '/';
        if (path === '/404' || path === '/ara' || path.startsWith('/admin')) return false;
        if (/\.(xml|txt|webmanifest)$/.test(path)) return false;
        if (seo.noindex.has(path)) return false;
        return true;
      },
      serialize(item) {
        const path = new URL(item.url).pathname.replace(/\/$/, '') || '/';
        const known = seo.lastmod.get(path);
        if (known) item.lastmod = known;
        else delete item.lastmod;
        delete item.changefreq;
        delete item.priority;
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss(), adminPlugin()],
  },
});
