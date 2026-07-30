'use strict';

const DEFAULT_LIMIT = 20;

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toSummary(content) {
  const plain = String(content || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 280 ? `${plain.slice(0, 277)}...` : plain;
}

function absoluteUrl(path) {
  const siteUrl = String(hexo.config.url || 'http://localhost').replace(/\/+$/, '');
  const root = String(hexo.config.root || '/').replace(/^\/+|\/+$/g, '');
  const base = root ? `${siteUrl}/${root}/` : `${siteUrl}/`;
  return new URL(String(path || '').replace(/^\//, ''), base).href;
}

hexo.extend.generator.register('atom-feed', function generateAtomFeed(locals) {
  const feedConfig = hexo.config.feed || {};
  const path = feedConfig.path || 'atom.xml';
  const configuredLimit = Number(feedConfig.limit);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : DEFAULT_LIMIT;
  const posts = [];

  locals.posts.sort('date', -1).limit(limit).each((post) => posts.push(post));

  const updated = posts.length
    ? new Date(posts[0].updated || posts[0].date).toISOString()
    : new Date().toISOString();
  const feedUrl = absoluteUrl(path);
  const entries = posts.map((post) => {
    const postUrl = post.permalink || absoluteUrl(post.path);
    const published = new Date(post.date).toISOString();
    const postUpdated = new Date(post.updated || post.date).toISOString();
    const summary = toSummary(post.excerpt || post.content);

    return `  <entry>\n    <title>${escapeXml(post.title)}</title>\n    <id>${escapeXml(postUrl)}</id>\n    <link href="${escapeXml(postUrl)}"/>\n    <published>${published}</published>\n    <updated>${postUpdated}</updated>\n    <summary type="html">${escapeXml(summary)}</summary>\n  </entry>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(hexo.config.language || 'zh-CN')}">\n  <title>${escapeXml(hexo.config.title)}</title>\n  <id>${escapeXml(feedUrl)}</id>\n  <link href="${escapeXml(absoluteUrl('/'))}"/>\n  <link href="${escapeXml(feedUrl)}" rel="self"/>\n  <updated>${updated}</updated>\n  <author><name>${escapeXml(hexo.config.author || hexo.config.title)}</name></author>\n${entries}\n</feed>\n`;

  return { path, data: xml };
});
