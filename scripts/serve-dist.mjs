/** Tiny production-artifact server for local/CI tests, including a Pages subdirectory. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const args = process.argv.slice(2);
const read = (key, fallback) => { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1]; };
const port = Number(read('--port', '4173'));
const base = read('--base', '/formula-alchemy/');
if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^\/[\w/-]*\/$/.test(base))
    throw new Error('Invalid port/base');
await fs.access(path.join(root, 'index.html'));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
    try {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405).end();
            return;
        }
        const pathname = decodeURIComponent(new URL(req.url || '/', `http://127.0.0.1:${port}`).pathname);
        if (pathname === base.slice(0, -1)) {
            res.writeHead(302, { Location: base }).end();
            return;
        }
        if (!pathname.startsWith(base)) {
            res.writeHead(404).end('Not found');
            return;
        }
        const file = path.resolve(root, pathname.slice(base.length) || 'index.html');
        if (file !== root && !file.startsWith(root + path.sep)) {
            res.writeHead(403).end();
            return;
        }
        const data = await fs.readFile(file);
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : data);
    }
    catch {
        res.writeHead(404).end('Not found');
    }
});
server.listen(port, '127.0.0.1', () => console.log(`Production artifact: http://127.0.0.1:${port}${base}`));
for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => process.exit(0)));
