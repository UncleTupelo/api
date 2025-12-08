const http = require('http');
const { readFile, stat } = require('fs/promises');
const { createReadStream } = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname);
const DEFAULT_FILE = 'index.html';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, headers, stream) {
  res.writeHead(status, headers);
  if (stream) {
    stream.pipe(res);
  } else {
    res.end();
  }
}

async function handle(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let resolved = path.join(ROOT, urlPath);

  try {
    let fileStat = await stat(resolved);
    if (fileStat.isDirectory()) {
      resolved = path.join(resolved, DEFAULT_FILE);
      fileStat = await stat(resolved);
    }

    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    send(res, 200, { 'Content-Type': mime, 'Content-Length': fileStat.size }, createReadStream(resolved));
  } catch (err) {
    if (req.method === 'GET' && (urlPath === '/' || urlPath === `/${DEFAULT_FILE}`)) {
      try {
        const body = await readFile(path.join(ROOT, DEFAULT_FILE));
        send(res, 200, { 'Content-Type': MIME['.html'], 'Content-Length': body.length }, createReadStream(path.join(ROOT, DEFAULT_FILE)));
        return;
      } catch (innerErr) {
        // fall through to 404
      }
    }
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, { Allow: 'GET, HEAD' });
    return;
  }
  handle(req, res);
});

server.listen(PORT, () => {
  console.log(`Serving static files from ${ROOT} on http://localhost:${PORT}`);
});
