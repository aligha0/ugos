'use strict';

const path = require('node:path');

function resolveStaticPath(root, urlPath) {
  const requested = urlPath === '/' ? 'index.html' : String(urlPath || '').replace(/^\/+/, '');
  if (!requested || requested.includes('\0')) return null;

  const rootResolved = path.resolve(root);
  const file = path.resolve(rootResolved, requested);
  const relative = path.relative(rootResolved, file);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return file;
}

module.exports = { resolveStaticPath };
