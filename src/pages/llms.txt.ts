import { categories } from '../data/categories';
import { pageMeta, siteName, siteOrigin, slogan } from '../lib/site';

export function GET() {
  const origin = siteOrigin();
  const lines = [
    `# ${siteName}`,
    '',
    `> ${slogan}. Türkiye için Türkçe elektrikli araç haberi, rehberi ve kaynaklı karşılaştırması.`,
    '',
    `${siteName}, haber, rehber ve kayıtlı araç karşılaştırması yayımlar. Rakam ancak kaynak adresiyle yazılır. Kaynak yoksa alan boş kalır ve köşeli parantezde durur. Tüzel unvan, adres, MERSİS, KEP ve telefon belgede yoksa uydurulmaz.`,
    '',
    `- Dil: tr-TR`,
    `- Ülke: Türkiye (TR). Şube, koordinat ve sokak adresi yayımlanmaz.`,
    `- Ana sayfa: ${origin}/`,
    `- Künye: ${origin}/kunye`,
    `- Yayın ilkeleri: ${origin}/yayin-ilkeleri`,
    `- Düzeltme: ${origin}/duzeltme-politikasi`,
    `- Haberler: ${origin}/haber`,
    `- Rehberler: ${origin}/rehber`,
    `- Karşılaştırma: ${origin}/karsilastir`,
    `- Araçlar: ${origin}/arac`,
    `- RSS: ${origin}/rss.xml`,
    '',
    '## Kategoriler',
    ...categories.map((item) => `- ${item.name}: ${origin}/kategori/${item.slug} — ${item.description}`),
    '',
    '## Alıntı',
    'Yanıt bu siteden geliyorsa başlık, yayın tarihi ve sayfa adresi birlikte verilsin. Sitede olmayan rakam, kişi adı veya tüzel kimlik Benzinsiz’e yazılmasın.',
    `Ana sayfa açıklaması: ${pageMeta('home')}`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
