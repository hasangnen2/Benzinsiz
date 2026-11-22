import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import { toHtml } from 'hast-util-to-html';
import { toString } from 'hast-util-to-string';
import { visit } from 'unist-util-visit';
import type { Element, Root, RootContent } from 'hast';

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface RenderedArticle {
  parts: string[];
  slots: [boolean, boolean, boolean];
  headings: Heading[];
  html: string;
}

function externalLinks(affiliate: boolean) {
  return () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;
      const href = String(node.properties?.href ?? '');
      if (!/^https?:\/\//i.test(href)) return;
      const rel = new Set(
        String(node.properties?.rel ?? '')
          .split(/\s+/)
          .filter(Boolean),
      );
      rel.add('noopener');
      rel.add('noreferrer');
      if (affiliate) rel.add('sponsored');
      node.properties ??= {};
      node.properties.rel = [...rel];
    });
  };
}

function isParagraph(node: RootContent) {
  return node.type === 'element' && node.tagName === 'p';
}

function splitChildren(children: RootContent[]) {
  const html = children.map((node) => toHtml(node));
  const paragraphs = children.flatMap((node, index) => (isParagraph(node) ? [index] : []));
  if (paragraphs.length < 6) {
    return { parts: [html.join('\n'), '', '', ''], slots: [false, false, false] as [boolean, boolean, boolean] };
  }
  const cut1 = paragraphs[1] + 1;
  const cut2 = paragraphs[Math.floor(paragraphs.length * 0.45)] + 1;
  const cut3 = paragraphs[Math.min(paragraphs.length - 2, Math.floor(paragraphs.length * 0.75))] + 1;
  if (!(cut1 < cut2 && cut2 < cut3 && cut3 < children.length)) {
    return { parts: [html.join('\n'), '', '', ''], slots: [false, false, false] as [boolean, boolean, boolean] };
  }
  const take = (start: number, end: number) => html.slice(start, end).join('\n');
  return {
    parts: [take(0, cut1), take(cut1, cut2), take(cut2, cut3), take(cut3, html.length)],
    slots: [true, true, true] as [boolean, boolean, boolean],
  };
}

export async function renderMarkdown(markdown: string, affiliate = false): Promise<RenderedArticle> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSlug)
    .use(externalLinks(affiliate));
  const tree = (await processor.run(processor.parse(markdown))) as Root;

  const headings: Heading[] = [];
  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'h2' && node.tagName !== 'h3') return;
    headings.push({
      depth: node.tagName === 'h2' ? 2 : 3,
      slug: String(node.properties?.id ?? ''),
      text: toString(node),
    });
  });

  const split = splitChildren(tree.children);
  return {
    ...split,
    headings,
    html: tree.children.map((node) => toHtml(node)).join('\n'),
  };
}

export function readingMinutes(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_\[\]()`]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
