// Zero-dependency static server for local testing.
// Usage: node tools/serve.js [port]   (default 8080)
// Listens on all interfaces so an iPhone on the same Wi-Fi can open it too.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
// Only the app itself is served, not the tooling or anything else in the folder.
const BLOCKED = ['tools', 'node_modules', '.git'];

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    const rel = file.slice(ROOT.length).split(sep).filter(Boolean);
    if (!file.startsWith(ROOT) || BLOCKED.includes(rel[0])) { res.writeHead(403).end('Forbidden'); return; }
    if (!(await stat(file)).isFile()) throw Object.assign(new Error('not a file'), { code: 'ENOENT' });
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      // Don't let the browser's HTTP cache mask edits during development.
      'Cache-Control': 'no-cache',
    });
    res.end(body);
    console.log(`200 ${req.method} ${path}`);
  } catch (err) {
    const code = err.code === 'ENOENT' ? 404 : 500;
    if (code === 500) console.error(`500 ${req.url}`, err);
    else console.log(`404 ${req.url}`);
    res.writeHead(code).end(code === 404 ? 'Not found' : 'Server error');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`betterBone dev server\n  This PC:  http://localhost:${PORT}/`);
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  Phone:    http://${a.address}:${PORT}/   (same Wi-Fi; no offline mode over plain http)`);
    }
  }
  console.log('Ctrl+C to stop.');
});
