import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
mkdirSync(publicDir, { recursive: true });

const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112">
  <rect width="112" height="112" fill="#0A1F3C"/>
  <g transform="translate(32 32)">
    <circle cx="24" cy="24" r="20" fill="none" stroke="#2BD9A4" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="104.2 21.5" transform="rotate(-59 24 24)"/>
    <polygon points="26.5,14.8 19.8,25.7 24,25.7 21.5,34 29,22.3 24.8,22.3" fill="#F4F1E8"/>
  </g>
</svg>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F4F1E8"/>
  <rect width="1200" height="16" fill="#0A1F3C"/>
  <rect y="614" width="1200" height="16" fill="#C9A45C"/>
  <g transform="translate(96 255) scale(2.2)">
    <circle cx="24" cy="24" r="20" fill="none" stroke="#0F6B6B" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="104.2 21.5" transform="rotate(-59 24 24)"/>
    <polygon points="26.5,14.8 19.8,25.7 24,25.7 21.5,34 29,22.3 24.8,22.3" fill="#0A1F3C"/>
  </g>
  <text x="250" y="300" font-family="Georgia, serif" font-size="84" fill="#0A1F3C">Benzinsiz</text>
  <text x="250" y="365" font-family="Georgia, serif" font-size="32" fill="#0F6B6B">Elektrikli araç dünyasında güvenilir kaynak</text>
</svg>`;

const logoPng = await sharp(Buffer.from(logo)).png().toBuffer();
await sharp(logoPng).toFile(join(publicDir, 'logo-112.png'));
await sharp(logoPng).resize(180, 180).png().toFile(join(publicDir, 'apple-touch-icon.png'));

const ogPng = await sharp(Buffer.from(og)).png().toBuffer();
await sharp(ogPng).png().toFile(join(publicDir, 'og-default.png'));
await sharp(ogPng).webp({ quality: 80 }).toFile(join(publicDir, 'og-default.webp'));
await sharp(ogPng).avif({ quality: 50 }).toFile(join(publicDir, 'og-default.avif'));

console.log('Marka görselleri public/ altına yazıldı.');
