import { loadArticles } from '../lib/articles';
import { absUrl, siteName } from '../lib/site';
import { istanbulIso, withinLastHours } from '../lib/dates';

function esc(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET() {
  const articles = (await loadArticles()).filter((item) => item.type === 'haber' && withinLastHours(item.publishedAt, 48));
  const urls = articles
    .map(
      (article) => `  <url>
    <loc>${esc(absUrl(article.href))}</loc>
    <lastmod>${esc(istanbulIso(article.updatedAt))}</lastmod>
    <news:news>
      <news:publication>
        <news:name>${esc(siteName)}</news:name>
        <news:language>tr</news:language>
      </news:publication>
      <news:publication_date>${esc(istanbulIso(article.publishedAt))}</news:publication_date>
      <news:title>${esc(article.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
