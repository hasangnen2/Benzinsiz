import { handleAdmin } from './handle.mjs';

function attach(server) {
  server.middlewares.use((req, res, next) => {
    const url = req.url || '';
    if (!url.startsWith('/api/admin')) return next();
    handleAdmin(req, res).catch((error) => {
      console.error(error);
      if (res.writableEnded) return;
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Sunucu hatası.' }));
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
