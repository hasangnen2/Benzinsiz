import { handleAdmin } from './handle.mjs';

function attach(server) {
  server.middlewares.use((req, res, next) => {
    const url = req.url || '';
    if (!url.startsWith('/api/admin')) return next();
    handleAdmin(req, res).catch((error) => {
      console.error(error);
      if (res.writableEnded) return;
      const safe = ['JSON okunamadı.', 'İstek çok büyük.', 'Dosya 5 MB sınırını aşıyor.'];
      const message = error instanceof Error && safe.includes(error.message) ? error.message : 'Sunucu hatası.';
      res.statusCode = message === 'İstek çok büyük.' || message === 'Dosya 5 MB sınırını aşıyor.' ? 413 : message === 'JSON okunamadı.' ? 400 : 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: message }));
    });
  });
}

export function adminPlugin() {
  return {
    name: 'benzinsiz-admin',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
