import { siteOrigin } from '../lib/site';

export function GET() {
  const origin = siteOrigin();
  const shared = `Allow: /
Disallow: /admin

`;
  const body = `User-agent: *
${shared}User-agent: GPTBot
${shared}User-agent: Google-Extended
${shared}User-agent: PerplexityBot
${shared}User-agent: ClaudeBot
${shared}User-agent: Applebot-Extended
${shared}Sitemap: ${origin}/sitemap-index.xml
Sitemap: ${origin}/news-sitemap.xml
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
