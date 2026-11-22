# Benzinsiz

Türkçe elektrikli araç haber, rehber ve karşılaştırma sitesi. Statik Astro çıktısıdır. Rakam yalnızca veri dosyasında kaynak ve güncelleme tarihiyle durur; boş alan sayfada `[köşeli parantez]` olarak kalır.

## Çalıştırma

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev            # http://localhost:4321
```

Üretim derlemesi ve önizleme:

```bash
npm run validate
npm run assets
npm run build          # sitemap, RSS, news-sitemap, ads.txt, Pagefind
npm run preview        # http://127.0.0.1:4321
```

Arama dizini `npm run build` sırasında oluşur. `npm run dev` içinde Pagefind sonucu görünmez; aramayı önizlemede dene.

Yayına almadan `PUBLIC_SITE_URL` değerini gerçek köke çevir. Canonical, sitemap, RSS ve JSON-LD bu adresi kullanır.

## İçerik

- Yazı: `src/content/articles/haber/` veya `src/content/articles/rehber/`. Slug dosya adıdır ve değişmez. Eski adres `src/data/redirects.json` içine `{ "from", "to" }` olarak yazılır; derleme 301 üretir.
- Karşılaştırma: `src/data/cars.json`. Kalıcı adres slug sırasına göredir (`/karsilastir/model-a-vs-model-b`). Ters sıra aynı adrese 301 döner.
- Tarife: `src/data/tariffs.json`. Fiyat `null` ise hesaplayıcı o satırı seçilemez yapar; sonuç ancak ziyaretçi sayı yazınca çıkar.
- Yazar: `src/data/authors.json`.

`npm run validate` başlık uzunluğunu, tarih sırasını, uydurma birim kalıplarını ve kaynakız rakamı kontrol eder.

## Reklam ve KVKK

Reklam ve ölçüm, çerez onayı (veya `PUBLIC_CMP_SCRIPT_URL` ile bağlanan TCF CMP) gelmeden yüklenmez. Otomatik reklam kapalıdır. `/ads.txt` yalnızca `PUBLIC_ADSENSE_PUBLISHER_ID` `pub-` ile başlayan bir sayıysa dolar.

## SEO uçları

- `/sitemap-index.xml` ve `/sitemap-0.xml`
- `/news-sitemap.xml` — yalnızca son 48 saatte yayımlanan haberler
- `/rss.xml` — haber ve rehber
- `/robots.txt`
- `/ads.txt`

## Yönlendirme

Vercel `vercel.json` ve Netlify `netlify.toml` (`force = true`) HTTP 301 verir. `astro preview` statik meta-refresh HTML dosyasını 200 ile sunar; tarayıcı yine kalıcı adrese gider, HTTP durum kodu 301 olmaz. Bunu yayın önizlemesinde (Vercel/Netlify) doğrula.
