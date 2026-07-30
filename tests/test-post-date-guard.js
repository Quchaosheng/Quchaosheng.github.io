'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { validatePostDates } = require('../scripts/post-date-guard');

function validate(content, now) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'post-date-guard-'));
  try {
    fs.writeFileSync(path.join(directory, 'post.md'), content, 'utf8');
    return validatePostDates(directory, now);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('rejects calendar dates that JavaScript would normalize', () => {
  const result = validate(
    '---\ndate: 2026-02-31 12:00:00\n---\n',
    new Date('2026-03-01T00:00:00Z')
  );
  assert.deepEqual(result.errors, ['post.md: missing or invalid date']);
});

test('interprets front matter in Asia/Shanghai on every host', () => {
  const result = validate(
    [
      '---',
      'date: 2026-07-30 08:00:00',
      'source_checked_at: 2026-07-30 08:00:00',
      'permalink: /2026/07/30/post/',
      '---',
      ''
    ].join('\n'),
    new Date('2026-07-30T00:04:00Z')
  );
  assert.deepEqual(result.errors, []);
});

test('rejects future Shanghai timestamps beyond the tolerance', () => {
  const result = validate(
    '---\ndate: 2026-07-30 08:10:00\n---\n',
    new Date('2026-07-30T00:04:00Z')
  );
  assert.deepEqual(result.errors, [
    'post.md: note date is in the future (2026-07-30 08:10:00)'
  ]);
});

test('checks permalink dates in Shanghai calendar time', () => {
  const result = validate(
    [
      '---',
      'date: 2026-07-30 00:30:00',
      'source_checked_at: 2026-07-30 00:00:00',
      'permalink: /2026/07/29/post/',
      '---',
      ''
    ].join('\n'),
    new Date('2026-07-30T12:00:00Z')
  );
  assert.deepEqual(result.errors, [
    'post.md: note date does not match permalink date 2026-07-29'
  ]);
});
