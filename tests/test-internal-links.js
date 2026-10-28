'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkSite } = require('../scripts/check-internal-links.js');

function site(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-links-'));
  for (const [name, body] of Object.entries(files)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}

const page = (body) => `<!doctype html><html><body>${body}</body></html>`;

test('accepts relative, site-root and directory-index links', () => {
  const root = site({
    'index.html': page('<a href="/about/">a</a><a href="posts/one/">b</a><a href="assets/x.css">c</a>'),
    'about/index.html': page('about'),
    'posts/one/index.html': page('one'),
    'assets/x.css': 'body{}',
  });
  const result = checkSite(root);
  assert.deepStrictEqual(result.problems, []);
  assert.strictEqual(result.checked, 3);
});

test('reports a missing page and a missing asset', () => {
  const root = site({
    'index.html': page('<a href="/nope/">a</a><img src="/missing.png">'),
  });
  const result = checkSite(root);
  assert.deepStrictEqual(
    result.problems.map((p) => p.reason),
    ['no such page or asset', 'no such page or asset']
  );
});

test('checks fragments against the page they point at', () => {
  const root = site({
    'index.html': page('<a href="#here">ok</a><h2 id="here">x</h2><a href="/about/#there">ok</a><a href="#gone">bad</a>'),
    'about/index.html': page('<h2 id="there">y</h2>'),
  });
  const result = checkSite(root);
  assert.strictEqual(result.problems.length, 1);
  assert.match(result.problems[0].reason, /no anchor "gone"/);
});

test('ignores external, mail and tel links but counts them as external', () => {
  const root = site({
    'index.html': page(
      '<a href="https://example.com/x">e</a><a href="mailto:a@b.c">m</a><a href="tel:+1">t</a>'
    ),
  });
  const result = checkSite(root);
  assert.deepStrictEqual(result.problems, []);
  assert.strictEqual(result.checked, 0);
  assert.strictEqual(result.external.length, 1);
});

test('resolves URL-encoded Chinese paths', () => {
  const root = site({
    'index.html': page('<a href="/%E4%B8%AD%E6%96%87/">c</a>'),
    '中文/index.html': page('chinese'),
  });
  const result = checkSite(root);
  assert.deepStrictEqual(result.problems, []);
});

test('ignores the query string when resolving', () => {
  const root = site({
    'index.html': page('<a href="/about/?from=index">a</a>'),
    'about/index.html': page('about'),
  });
  const result = checkSite(root);
  assert.deepStrictEqual(result.problems, []);
});

test('follows a redirect stub and reports a broken destination', () => {
  const good = site({
    'index.html': page('<a href="/old/">old</a>'),
    'old/index.html': page('<meta http-equiv="refresh" content="0; url=/new/">'),
    'new/index.html': page('new'),
  });
  assert.deepStrictEqual(checkSite(good).problems, []);

  const bad = site({
    'index.html': page('<a href="/old/">old</a>'),
    'old/index.html': page('<meta http-equiv="refresh" content="0; url=/gone/">'),
  });
  const result = checkSite(bad);
  assert.strictEqual(result.problems.length, 1);
  assert.match(result.problems[0].reason, /redirect target/);
});

test('treats a same-host absolute URL as internal', () => {
  const root = site({
    'index.html': page('<a href="https://quchaosheng.github.io/about/">a</a>'),
    'about/index.html': page('about'),
  });
  const result = checkSite(root, { siteUrl: 'https://quchaosheng.github.io' });
  assert.deepStrictEqual(result.problems, []);
  assert.strictEqual(result.checked, 1);
});

test('skips script-driven controls and svg symbol references', () => {
  const root = site({
    'index.html': page(
      '<a href="#theme" role="button">toggle</a>' +
        '<svg><use href="#icon-x"></use></svg>'
    ),
  });
  const result = checkSite(root);
  assert.deepStrictEqual(result.problems, []);
  assert.strictEqual(result.checked, 0);
});

test('does not descend into vendor directories', () => {
  const root = site({
    'index.html': page('<a href="/about/">a</a>'),
    'about/index.html': page('about'),
    'fonts/iconfont/demo_index.html': page('<a href="#nothing">demo</a>'),
  });
  const result = checkSite(root);
  assert.deepStrictEqual(result.problems, []);
  assert.strictEqual(result.files, 2);
});
