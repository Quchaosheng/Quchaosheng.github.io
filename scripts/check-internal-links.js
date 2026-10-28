#!/usr/bin/env node
'use strict';

// Checks the HTML that Hexo generated: every internal href/src has to resolve
// to a file in public/, and every fragment to an id in the page it points at.
// The build succeeding says nothing about that, so a renamed heading or a moved
// post can publish a site whose navigation is broken.

const fs = require('fs');
const path = require('path');

const SKIP_SCHEMES = ['mailto:', 'tel:', 'javascript:', 'data:', 'ftp:'];
const ATTR = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const ID = /\b(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const META_REFRESH = /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/i;
const CONTENT_URL = /content\s*=\s*["'][^"']*url\s*=\s*([^"';]+)/i;

function walk(dir, out = [], ignore = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(dir, full);
    if (ignore.some((prefix) => relative.split(path.sep)[0].startsWith(prefix))) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(full, out, ignore);
    } else if (/\.html?$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// The tag a matched attribute belongs to, so <use href="#icon"> and an anchor
// that only exists to be driven by script can be told from navigation.
function tagAt(html, index) {
  const open = html.lastIndexOf('<', index);
  const close = html.indexOf('>', index);
  return open < 0 || close < 0 ? '' : html.slice(open, close + 1);
}

// Hexo writes Chinese post slugs URL-encoded into the HTML; the file system has
// them decoded. Decode every segment, and leave a malformed escape alone rather
// than throwing on it.
function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function classify(raw, pageUrl) {
  const value = raw.trim();
  if (!value || value === '#') {
    return { kind: 'skip' };
  }
  const lower = value.toLowerCase();
  if (SKIP_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    return { kind: 'skip' };
  }
  if (value.startsWith('//')) {
    return { kind: 'external', url: value };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    const sameHost = pageUrl && value.toLowerCase().startsWith(pageUrl.toLowerCase());
    if (!sameHost) {
      return { kind: 'external', url: value };
    }
    return split(value.slice(pageUrl.length) || '/');
  }
  return split(value);
}

function split(value) {
  const hash = value.indexOf('#');
  const fragment = hash >= 0 ? value.slice(hash + 1) : '';
  const withoutHash = hash >= 0 ? value.slice(0, hash) : value;
  const question = withoutHash.indexOf('?');
  const pathname = question >= 0 ? withoutHash.slice(0, question) : withoutHash;
  const query = question >= 0 ? withoutHash.slice(question) : '';
  return { kind: 'internal', pathname, query, fragment };
}

// A URL path is not a file path: a directory answers with its index.html, and
// Hexo writes /foo/bar/ for a post as bar/index.html.
function candidates(publicDir, pathname, fromFile) {
  const clean = decodePath(pathname);
  const base = clean.startsWith('/')
    ? path.join(publicDir, clean.slice(1))
    : path.join(path.dirname(fromFile), clean);
  const resolved = path.resolve(base);
  if (!resolved.startsWith(path.resolve(publicDir))) {
    return null;
  }
  if (clean.endsWith('/') || clean === '' || clean === '/') {
    return [path.join(resolved, 'index.html')];
  }
  return [resolved, path.join(resolved, 'index.html'), `${resolved}.html`];
}

function idsIn(html) {
  const ids = new Set();
  let match;
  ID.lastIndex = 0;
  while ((match = ID.exec(html)) !== null) {
    ids.add(match[1] !== undefined ? match[1] : match[2]);
  }
  return ids;
}

function redirectTarget(html) {
  if (!META_REFRESH.test(html)) {
    return null;
  }
  const match = CONTENT_URL.exec(html);
  return match ? match[1].trim() : null;
}

function checkSite(publicDir, options = {}) {
  const pageUrl = options.siteUrl || '';
  const ignore = options.ignore || ['fonts', 'vendors', 'js', 'css'];
  const files = walk(publicDir, [], ignore);
  const problems = [];
  const external = new Set();
  let checked = 0;
  const cache = new Map();

  const read = (file) => {
    if (!cache.has(file)) {
      cache.set(file, fs.readFileSync(file, 'utf8'));
    }
    return cache.get(file);
  };

  for (const file of files) {
    const html = read(file);
    let match;
    ATTR.lastIndex = 0;
    while ((match = ATTR.exec(html)) !== null) {
      const raw = match[1] !== undefined ? match[1] : match[2];
      const tag = tagAt(html, match.index);
      if (/^<use\b/i.test(tag) || /\brole\s*=\s*["']button["']/i.test(tag)) {
        continue;
      }
      const link = classify(raw, pageUrl);
      if (link.kind === 'skip') {
        continue;
      }
      if (link.kind === 'external') {
        external.add(link.url);
        continue;
      }
      checked += 1;

      const tries = candidates(publicDir, link.pathname, file);
      if (tries === null) {
        problems.push({ file, link: raw, reason: 'escapes the site root' });
        continue;
      }
      const target = tries.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!target) {
        problems.push({ file, link: raw, reason: 'no such page or asset' });
        continue;
      }

      if (link.fragment) {
        const targetHtml = /\.html?$/i.test(target) ? read(target) : '';
        const ids = idsIn(targetHtml);
        if (!ids.has(link.fragment) && !ids.has(decodePath(link.fragment))) {
          problems.push({ file, link: raw, reason: `no anchor "${link.fragment}"` });
          continue;
        }
      }

      // A page that moves leaves a redirect behind; the destination has to
      // exist too, or the permanent URL is broken even though the stub is fine.
      if (/\.html?$/i.test(target)) {
        const redirect = redirectTarget(read(target));
        if (redirect) {
          const next = classify(redirect, pageUrl);
          if (next.kind === 'internal') {
            const nextTries = candidates(publicDir, next.pathname, target);
            const nextFile = nextTries && nextTries.find((candidate) => fs.existsSync(candidate));
            if (!nextFile) {
              problems.push({ file, link: raw, reason: `redirect target "${redirect}" does not exist` });
            }
          }
        }
      }
    }
  }

  return { files: files.length, checked, problems, external: [...external] };
}

function main(argv) {
  const publicDir = path.resolve(argv[2] || 'public');
  if (!fs.existsSync(publicDir)) {
    console.error(`check-internal-links: ${publicDir} does not exist; run the build first`);
    return 2;
  }
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  const result = checkSite(publicDir, { siteUrl });

  console.log(
    `check-internal-links: ${result.checked} internal links in ${result.files} pages, ` +
      `${result.external.length} external left for the separate report`
  );
  if (result.problems.length) {
    for (const problem of result.problems) {
      console.error(`  ${path.relative(publicDir, problem.file)}: ${problem.link} (${problem.reason})`);
    }
    console.error(`check-internal-links: ${result.problems.length} broken`);
    return 1;
  }
  console.log('check-internal-links: no broken internal links');
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = { checkSite, classify, candidates, idsIn, redirectTarget };
