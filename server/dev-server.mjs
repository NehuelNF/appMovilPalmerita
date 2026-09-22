import { createServer } from 'node:http';
import worker from './worker.mjs';

const PORT = 3000;

const server = createServer(async (req, res) => {
  try {
    const fullUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }
    }

    const request = new Request(fullUrl.toString(), {
      method: req.method,
      headers
    });

    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => new Response('Not found', { status: 404 })
      }
    });

    res.statusCode = response.status;
    response.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Server error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server API listening on http://localhost:${PORT}`);
});
