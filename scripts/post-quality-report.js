'use strict';

const fs = require('fs');
const path = require('path');

const POSTS_DIRECTORY = path.join(__dirname, '..', 'source', '_posts');
const SHORT_POST_LIMIT = 650;

function splitPost(content) {
  const normalized = String(content || '').replace(/^\uFEFF/, '');
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return null;
  }
  return { frontMatter: match[1], body: match[2] };
}

function readTitle(frontMatter, fallback) {
  const match = frontMatter.match(/^title:\s*(.+?)\s*$/m);
  return match ? match[1].replace(/^(["'])(.*)\1$/, '$2') : fallback;
}

function visibleLength(body) {
  return body
    .replace(/\`\`\`[\s\S]*?\`\`\`/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\s\`*_#[\]()>.|:-]/g, '')
    .length;
}

function inspectPost(file) {
  const fullPath = path.join(POSTS_DIRECTORY, file);
  const parsed = splitPost(fs.readFileSync(fullPath, 'utf8'));
  if (!parsed) {
    return {
      file,
      title: file,
      errors: ['无法解析 front matter'],
      notices: []
    };
  }

  const { frontMatter, body } = parsed;
  const errors = [];
  const notices = [];
  const length = visibleLength(body);

  if (!/class=["']note-flow["']/.test(body)) {
    errors.push('缺少 note-flow');
  }
  if (!/class=["']note-map["']/.test(body)) {
    errors.push('缺少 note-map');
  }
  if (!/https?:\/\//i.test(body)) {
    errors.push('缺少外部参考链接');
  }
  if (length < SHORT_POST_LIMIT) {
    notices.push(`正文较短（${length} 字）`);
  }
  if (!/^##\s+证据边界\s*$/m.test(body)) {
    notices.push('没有单独的证据边界小节');
  }
  if (!/\`\`\`(?:bash|sh|shell|console|c|cpp|text|yaml)?\r?\n/i.test(body)) {
    notices.push('没有 fenced code 或命令块');
  }

  return {
    file,
    title: readTitle(frontMatter, file),
    errors,
    notices
  };
}

function printGroup(label, posts, field) {
  const affected = posts.filter((post) => post[field].length);
  console.log(`\n${label}：${affected.length}`);
  for (const post of affected) {
    console.log(`- ${post.file}：${post[field].join('；')}`);
  }
}

function countMessages(posts, field) {
  const counts = new Map();
  for (const post of posts) {
    for (const message of post[field]) {
      const key = message.replace(/正文较短（\d+ 字）/, `正文少于 ${SHORT_POST_LIMIT} 字`);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function printSummary(label, posts, field) {
  console.log(`\n${label}：`);
  const messages = countMessages(posts, field);
  if (!messages.length) {
    console.log('- 无');
    return;
  }
  for (const [message, count] of messages) {
    console.log(`- ${message}：${count} 篇`);
  }
}

function run() {
  const posts = fs.readdirSync(POSTS_DIRECTORY)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map(inspectPost);
  const errorCount = posts.reduce((sum, post) => sum + post.errors.length, 0);
  const noticeCount = posts.reduce((sum, post) => sum + post.notices.length, 0);

  console.log(`文章质量报告：检查 ${posts.length} 篇`);
  console.log(`结构缺口 ${errorCount} 项，人工复核提示 ${noticeCount} 项。`);
  console.log('提示项不阻止构建，概念文章不要求为了形式强加代码。');

  printSummary('结构缺口', posts, 'errors');
  printSummary('人工复核', posts, 'notices');

  if (process.argv.includes('--verbose')) {
    printGroup('结构缺口明细', posts, 'errors');
    printGroup('人工复核明细', posts, 'notices');
  }

  if (process.argv.includes('--strict') && errorCount > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run();
}

module.exports = { inspectPost, splitPost, visibleLength };
