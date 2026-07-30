'use strict';

const fs = require('fs');
const path = require('path');

const FRONT_MATTER_BOUNDARY = '---';
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function readFrontMatter(content) {
  const lines = String(content || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0] !== FRONT_MATTER_BOUNDARY) {
    return {};
  }

  const values = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === FRONT_MATTER_BOUNDARY) {
      break;
    }

    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*?)\s*$/);
    if (!match) {
      continue;
    }

    values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }

  return values;
}

function parseLocalDateTime(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const [yearNumber, monthNumber, dayNumber, hourNumber, minuteNumber, secondNumber] = parts;
  const validation = new Date(Date.UTC(
    yearNumber,
    monthNumber - 1,
    dayNumber,
    hourNumber,
    minuteNumber,
    secondNumber
  ));
  if (
    validation.getUTCFullYear() !== yearNumber ||
    validation.getUTCMonth() !== monthNumber - 1 ||
    validation.getUTCDate() !== dayNumber ||
    validation.getUTCHours() !== hourNumber ||
    validation.getUTCMinutes() !== minuteNumber ||
    validation.getUTCSeconds() !== secondNumber
  ) {
    return null;
  }
  return new Date(validation.getTime() - SHANGHAI_OFFSET_MS);
}

function localDateKey(date) {
  const shanghaiDate = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  const year = String(shanghaiDate.getUTCFullYear()).padStart(4, '0');
  const month = String(shanghaiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shanghaiDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function permalinkDate(permalink) {
  const match = String(permalink || '').match(/^\/(\d{4})\/(\d{2})\/(\d{2})\//);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function validatePostDates(postsDirectory, now = new Date()) {
  const errors = [];
  const files = fs.readdirSync(postsDirectory)
    .filter((name) => name.endsWith('.md'))
    .sort();

  for (const file of files) {
    const fullPath = path.join(postsDirectory, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const frontMatter = readFrontMatter(content);
    const noteDate = parseLocalDateTime(frontMatter.date);

    if (!noteDate) {
      errors.push(`${file}: missing or invalid date`);
      continue;
    }

    if (noteDate.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
      errors.push(`${file}: note date is in the future (${frontMatter.date})`);
    }

    const hasPublicAccountSource = /https?:\/\/mp\.weixin\.qq\.com\//i.test(content);
    const sourcePublishedAt = parseLocalDateTime(frontMatter.source_published_at);
    const sourceCheckedAt = parseLocalDateTime(frontMatter.source_checked_at);

    if (hasPublicAccountSource && !sourcePublishedAt && !sourceCheckedAt) {
      errors.push(`${file}: public-account reference needs source_published_at or source_checked_at`);
    }

    for (const [field, sourceDate] of [
      ['source_published_at', sourcePublishedAt],
      ['source_checked_at', sourceCheckedAt]
    ]) {
      if (!sourceDate) {
        continue;
      }
      if (sourceDate.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
        errors.push(`${file}: ${field} is in the future (${frontMatter[field]})`);
      }
      if (noteDate.getTime() < sourceDate.getTime()) {
        errors.push(`${file}: note date precedes ${field}`);
      }
    }

    if (sourcePublishedAt || sourceCheckedAt) {
      const pathDate = permalinkDate(frontMatter.permalink);
      if (pathDate && localDateKey(noteDate) !== pathDate) {
        errors.push(`${file}: note date does not match permalink date ${pathDate}`);
      }
    }
  }

  return { errors, checked: files.length };
}

if (typeof hexo !== 'undefined' && hexo.extend) {
  hexo.extend.filter.register('before_generate', function guardPostDates() {
    const postsDirectory = path.join(hexo.source_dir, '_posts');
    const result = validatePostDates(postsDirectory);
    if (result.errors.length) {
      throw new Error(`Post date integrity check failed:\n- ${result.errors.join('\n- ')}`);
    }
    hexo.log.info(`Post date integrity check passed for ${result.checked} posts`);
  });
}

module.exports = { validatePostDates };
