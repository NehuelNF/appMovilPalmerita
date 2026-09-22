module.exports = [
  {
    context: ['/api'],
    target: 'http://localhost:4200',
    secure: false,
    bypass: async function (req, res) {
      try {
        const { resolvePlayer, resolveMedia } = await import('./server/worker.mjs');
        const url = new URL(req.url, 'http://localhost:4200');
        const fetchReq = new Request(url.href, {
          method: req.method,
          headers: req.headers
        });
        let workerRes;
        if (url.pathname === '/api/player') {
          workerRes = await resolvePlayer(fetchReq);
        } else if (url.pathname === '/api/media') {
          workerRes = await resolveMedia(fetchReq);
        }
        if (workerRes) {
          res.writeHead(workerRes.status, Object.fromEntries(workerRes.headers.entries()));
          const body = await workerRes.text();
          res.end(body);
          return false;
        }
      } catch (err) {
        console.error('Error en proxy /api:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error interno en el servidor local' }));
        return false;
      }
      return false;
    }
  }
];
