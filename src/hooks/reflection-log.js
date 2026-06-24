#!/usr/bin/env node
// reflection — changelog summary for /reflection-log.
//
// Reads <cwd>/reflection-changelog.md and prints a brief, scannable summary:
// rounds logged, coverage per question slug, open (proposed/deferred) items,
// and recently applied fixes. Output is injected as the hook's block reason.

const fs = require('fs');
const path = require('path');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const cwd = arg('--cwd', process.cwd());
const changelogPath = path.join(cwd, 'reflection-changelog.md');

let text;
try {
  const st = fs.lstatSync(changelogPath);
  if (st.isSymbolicLink() || !st.isFile()) throw new Error('not a regular file');
  text = fs.readFileSync(changelogPath, 'utf8');
} catch (e) {
  process.stdout.write('No reflection-changelog.md found in ' + cwd + '. Run /reflection-init to create it.');
  process.exit(0);
}

// Split into entries on `## ` headers. Ignore anything inside fenced code
// blocks (```), so the template example in a freshly-seeded changelog isn't
// counted as a real round.
const lines = text.split('\n');
const entries = [];
let cur = null;
let inFence = false;
for (const line of lines) {
  if (/^\s*```/.test(line)) { inFence = !inFence; if (cur) cur.body.push(line); continue; }
  if (!inFence && /^##\s+/.test(line)) {
    if (cur) entries.push(cur);
    cur = { header: line.replace(/^##\s+/, '').trim(), body: [] };
  } else if (cur) {
    cur.body.push(line);
  }
}
if (cur) entries.push(cur);

if (!entries.length) {
  process.stdout.write('reflection-changelog.md exists but has no logged rounds yet. Run /reflection to start one.');
  process.exit(0);
}

const slugRe = /<!--\s*q:([a-z][a-z-]{0,23})\s*-->/;
const dateRe = /(\d{4}-\d{2}-\d{2})/;
const perSlug = {};
const open = [];
const applied = [];
const dates = [];

for (const e of entries) {
  const slugM = e.header.match(slugRe);
  const slug = slugM ? slugM[1] : '(unknown)';
  perSlug[slug] = (perSlug[slug] || 0) + 1;
  const dM = e.header.match(dateRe);
  if (dM) dates.push(dM[1]);

  const bodyText = e.body.join('\n');
  const statusM = bodyText.match(/\*\*Status:\*\*\s*([a-z]+)/i);
  const status = statusM ? statusM[1].toLowerCase() : 'unknown';
  const findingM = bodyText.match(/\*\*Finding:\*\*\s*(.+)/);
  const finding = findingM ? findingM[1].trim() : e.header;

  if (status === 'proposed' || status === 'deferred') {
    open.push({ slug, status, finding });
  } else if (status === 'applied') {
    applied.push({ slug, finding });
  }
}

const out = [];
out.push('Reflection log — ' + entries.length + ' round(s)' +
  (dates.length ? ', ' + dates[0] + ' → ' + dates[dates.length - 1] : '') + '.');

out.push('');
out.push('Coverage by question:');
const sortedSlugs = Object.keys(perSlug).sort((a, b) => perSlug[b] - perSlug[a]);
out.push('  ' + sortedSlugs.map(s => s + '×' + perSlug[s]).join('  '));

if (open.length) {
  out.push('');
  out.push('Open items (' + open.length + '):');
  for (const o of open.slice(-8)) out.push('  [' + o.status + '] ' + o.slug + ': ' + o.finding);
} else {
  out.push('');
  out.push('Open items: none.');
}

if (applied.length) {
  out.push('');
  out.push('Recently applied:');
  for (const a of applied.slice(-5)) out.push('  ' + a.slug + ': ' + a.finding);
}

process.stdout.write(out.join('\n'));
