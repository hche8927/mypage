#!/usr/bin/env node
/**
 * Tiny static file server for local development (no dependencies).
 * Usage: `npm run serve` -> http://localhost:8000   (PORT=3000 npm run serve to change it)
 *
 * Opening index.html straight from disk also works; a server is only needed to
 * test how the site behaves when served, or to view it from a phone on the same
 * network (open http://<this-computer's-LAN-IP>:8000).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8000;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.md': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);

    // Never serve anything outside the project folder or from .git
    if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}.git${path.sep}`)) {
        res.writeHead(403).end('Forbidden');
        return;
    }
    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404).end('Not found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}`));
