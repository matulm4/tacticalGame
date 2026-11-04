// Dependency-free static file server for local development.
// Browsers block ES modules on file://, so the game must be served over http.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    let relative = decodeURIComponent(pathname);
    if (relative.endsWith('/')) relative += 'index.html';

    const file = path.join(root, relative);
    const inRoot = file.startsWith(root + path.sep);
    const hidden = relative.split('/').some((part) => part.startsWith('.'));
    if (!inRoot || hidden) return send(res, 403, 'Forbidden');

    const info = await stat(file);
    if (!info.isFile()) return send(res, 404, 'Not found');

    const body = await readFile(file);
    const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    // no-store: always serve the latest source while developing.
    send(res, 200, body, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  } catch {
    send(res, 404, 'Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root}`);
  console.log(`Open http://localhost:${port}`);
});
