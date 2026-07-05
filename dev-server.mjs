import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3001;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function resolveRoute(urlPath) {
  if (urlPath === '/' || urlPath === '/all' || urlPath === '/football' || urlPath === '/nfl' || urlPath === '/mma' || urlPath === '/boxing' || urlPath === '/formula-1' || urlPath === '/nba' || urlPath === '/wnba' || urlPath === '/mlb' || urlPath === '/cfl') {
    return 'index.html';
  }
  if (/^\/watch\/[^/]+$/i.test(urlPath)) return 'watch.html';
  if (urlPath === '/recaps' || /^\/[^/]+\/recaps$/i.test(urlPath)) return 'recaps.html';
  if (/^\/[^/]+\/recaps\/test-player\/.*$/i.test(urlPath)) return 'test-player.html';
  if (urlPath === '/favicon.ico') return 'Logo.svg';
  const normalized = urlPath.replace(/^\/+/, '');
  return normalized || 'index.html';
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const target = path.join(__dirname, resolveRoute(requestUrl.pathname));
  sendFile(res, target);
}).listen(port, () => {
  console.log(`GhoulStreams static dev server running on http://127.0.0.1:${port}`);
});
