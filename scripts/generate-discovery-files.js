'use strict';

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteUrl(path) {
  const siteUrl = String(hexo.config.url || 'http://localhost').replace(/\/+$/, '');
  const root = String(hexo.config.root || '/').replace(/^\/+|\/+$/g, '');
  const base = root ? `${siteUrl}/${root}/` : `${siteUrl}/`;
  return new URL(String(path || '').replace(/^\//, ''), base).href;
}

function toLastModified(value) {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function shouldIndex(page) {
  return page && page.path && page.path !== '404.html' && page.path !== 'search/index.html';
}

function canonicalUrl(page) {
  const url = page.permalink || absoluteUrl(page.path);
  return String(url).replace(/\/index\.html$/, '/');
}

hexo.extend.generator.register('discovery-files', function generateDiscoveryFiles(locals) {
  const entries = new Map();

  function addEntry(page) {
    if (!shouldIndex(page)) {
      return;
    }

    const url = canonicalUrl(page);
    if (!entries.has(url)) {
      entries.set(url, toLastModified(page.updated || page.date));
    }
  }

  entries.set(absoluteUrl('/'), '');
  locals.posts.each(addEntry);
  locals.pages.each(addEntry);

  const urls = Array.from(entries.entries())
    .sort(([leftUrl], [rightUrl]) => leftUrl.localeCompare(rightUrl))
    .map(([url, lastModified]) => {
      const lastModifiedElement = lastModified ? `\n    <lastmod>${lastModified}</lastmod>` : '';
      return `  <url>\n    <loc>${escapeXml(url)}</loc>${lastModifiedElement}\n  </url>`;
    })
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('sitemap.xml')}\n`;

  return [
    { path: 'sitemap.xml', data: sitemap },
    { path: 'robots.txt', data: robots }
  ];
});
