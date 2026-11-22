import rss from '@astrojs/rss';
import { loadArticles } from '../lib/articles';
import { renderMarkdown } from '../lib/markdown';
import { siteName, slogan } from '../lib/site';

export async function GET(context: { site: URL }) {
  const articles = (await loadArticles()).filter((item) => item.type === 'haber' || item.type === 'rehber');
  const items = [];
  for (const article of articles) {
    const rendered = await renderMarkdown(article.body, article.affiliate);
    const html = rendered.html.replace(/href="\//g, `href="${context.site.origin}/`).replace(/]]>/g, ']]&gt;');
    items.push({
      title: article.title,
      description: article.description,
      pubDate: article.publishedAt,
      link: article.href,
      categories: [article.categoryName, article.typeLabel],
      content: html,
    });
  }
  return rss({
    title: siteName,
    description: slogan,
    site: context.site,
    trailingSlash: false,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>tr-TR</language><atom:link href="${new URL('/rss.xml', context.site)}" rel="self" type="application/rss+xml"/>`,
    items,
  });
}
