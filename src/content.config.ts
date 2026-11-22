import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import authors from './data/authors.json';
import { categories } from './data/categories';

const categorySlugs = categories.map((item) => item.slug) as [
  (typeof categories)[number]['slug'],
  ...(typeof categories)[number]['slug'][],
];
const authorSlugs = authors.map((item) => item.slug) as [string, ...string[]];

const articles = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/articles',
    generateId: ({ entry }) => entry.replace(/\\/g, '/').replace(/\.(md|mdx)$/i, ''),
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(12).max(100),
        description: z.string().min(40).max(180),
        type: z.enum(['haber', 'rehber', 'karsilastirma']),
        category: z.enum(categorySlugs),
        author: z.enum(authorSlugs),
        publishedAt: z.coerce.date(),
        updatedAt: z.coerce.date(),
        sources: z
          .array(
            z.object({
              name: z.string().min(1),
              url: z.string().url().optional(),
            }),
          )
          .default([]),
        heroImage: image().optional(),
        heroAlt: z.string().min(1).optional(),
        summary: z.array(z.string().min(10)).min(1).max(6),
        featured: z.boolean().default(false),
        breaking: z.boolean().default(false),
        sponsored: z.boolean().default(false),
        affiliate: z.boolean().default(false),
        draft: z.boolean().default(false),
      })
      .superRefine((data, ctx) => {
        if (data.updatedAt < data.publishedAt) {
          ctx.addIssue({
            code: 'custom',
            message: 'updatedAt, publishedAt değerinden önce olamaz',
            path: ['updatedAt'],
          });
        }
        if (data.heroImage && !data.heroAlt) {
          ctx.addIssue({
            code: 'custom',
            message: 'Kapak görseli için heroAlt zorunlu',
            path: ['heroAlt'],
          });
        }
      }),
});

export const collections = { articles };
