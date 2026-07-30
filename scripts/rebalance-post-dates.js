'use strict';

const fs = require('fs');
const path = require('path');

function parseFrontMatter(content) {
  const boundary = content.indexOf('\n---', 3);
  if (!content.startsWith('---') || boundary < 0) {
    return {};
  }

  const values = {};
  for (const line of content.slice(3, boundary).split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*?)\s*$/);
    if (match) {
      values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  }
  return values;
}

function parseDate(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = '14', minute = '00', second = '00'] = match;
  return {
    date: new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
    time: `${hour}:${minute}:${second}`
  };
}

function formatDay(date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekdaysBetween(start, end) {
  const days = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      days.push(new Date(date));
    }
  }
  return days;
}

function rebalance(postsDirectory, options = {}) {
  const start = options.start || new Date(2026, 1, 2);
  const end = options.end || new Date(2026, 6, 28);
  const apply = Boolean(options.apply);
  const posts = [];

  for (const file of fs.readdirSync(postsDirectory).filter((name) => name.endsWith('.md'))) {
    const fullPath = path.join(postsDirectory, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const frontMatter = parseFrontMatter(content);
    if (frontMatter.source_checked_at || frontMatter.source_published_at) {
      continue;
    }

    const parsed = parseDate(frontMatter.date);
    if (!parsed) {
      throw new Error(`${file}: missing or invalid date`);
    }
    posts.push({ file, fullPath, content, original: parsed.date, time: parsed.time });
  }

  posts.sort((left, right) => left.original - right.original || left.file.localeCompare(right.file));
  const weekdays = weekdaysBetween(start, end);
  if (posts.length > weekdays.length) {
    throw new Error(`Not enough weekdays: ${posts.length} posts for ${weekdays.length} days`);
  }

  const assignments = posts.map((post, index) => {
    const dayIndex = posts.length === 1
      ? 0
      : Math.round(index * (weekdays.length - 1) / (posts.length - 1));
    const nextDate = `${formatDay(weekdays[dayIndex])} ${post.time}`;
    const nextContent = post.content.replace(
      /^date:\s*.*$/m,
      `date: ${nextDate}`
    );
    if (apply && nextContent !== post.content) {
      fs.writeFileSync(post.fullPath, nextContent, 'utf8');
    }
    return { file: post.file, from: formatDay(post.original), to: formatDay(weekdays[dayIndex]) };
  });

  return assignments;
}

if (require.main === module) {
  const postsDirectory = path.join(process.cwd(), 'source', '_posts');
  const assignments = rebalance(postsDirectory, { apply: process.argv.includes('--apply') });
  for (const assignment of assignments) {
    process.stdout.write(`${assignment.file}\t${assignment.from}\t${assignment.to}\n`);
  }
  process.stdout.write(`Rebalanced ${assignments.length} posts\n`);
}

module.exports = { rebalance };
