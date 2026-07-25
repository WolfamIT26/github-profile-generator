import fs from 'node:fs/promises';
import path from 'node:path';

export const log = {
  section(message) {
    console.log(`\n== ${message}`);
  },
  info(message) {
    console.log(`[info] ${message}`);
  },
  warn(message) {
    console.warn(`[warn] ${message}`);
  },
  error(message) {
    console.error(`[error] ${message}`);
  }
};

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

export async function readTextFile(filePath) {
  return fs.readFile(filePath, 'utf8');
}

export async function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      log.warn(`could not read ${path.relative(process.cwd(), filePath)}: ${error.message}`);
    }

    return fallback;
  }
}

export async function writeFileIfChanged(filePath, content) {
  let current = null;

  try {
    current = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (current === content) {
    log.info(`${path.relative(process.cwd(), filePath)} is already up to date`);
    return false;
  }

  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content);
  log.info(`wrote ${path.relative(process.cwd(), filePath)}`);
  return true;
}

export async function writeJsonFile(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function compact(items) {
  return items.filter(Boolean);
}

export function uniqueBy(items, getKey) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = typeof getKey === 'function' ? getKey(item) : item?.[getKey];

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

export async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

export function formatDate(value) {
  if (!value) {
    return 'unknown';
  }

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(value));
}

export function formatNumber(value = 0) {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(value);
}

export function percentage(part, total, digits = 1) {
  if (!total) {
    return 0;
  }

  return Number(((part / total) * 100).toFixed(digits));
}

export function toUrl(value = '') {
  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

export function shieldUrl({ label = '', message = '', color = '2ea44f', logo = '', logoColor = 'white', style = 'flat' }) {
  const params = new URLSearchParams({
    label,
    message,
    color: color.replace(/^#/, ''),
    style
  });

  if (logo) {
    params.set('logo', logo);
    params.set('logoColor', logoColor);
  }

  return `https://img.shields.io/static/v1?${params.toString()}`;
}

export function parseLastPageFromLinkHeader(linkHeader = '') {
  const lastLink = linkHeader
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="last"'));

  if (!lastLink) {
    return null;
  }

  const pageMatch = lastLink.match(/[?&]page=(\d+)/);
  return pageMatch ? Number(pageMatch[1]) : null;
}

export function sortByUpdatedDesc(repositories) {
  return [...repositories].sort((a, b) => {
    const bTime = new Date(b.updated_at || b.pushed_at || 0).getTime();
    const aTime = new Date(a.updated_at || a.pushed_at || 0).getTime();
    return bTime - aTime;
  });
}

export function sortByPushedDesc(repositories) {
  return [...repositories].sort((a, b) => {
    const bTime = new Date(b.pushed_at || b.updated_at || 0).getTime();
    const aTime = new Date(a.pushed_at || a.updated_at || 0).getTime();
    return bTime - aTime || a.full_name.localeCompare(b.full_name);
  });
}

export function sortByDiscoveryDesc(repositories) {
  return [...repositories].sort((a, b) => {
    const updatedDelta = new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    const pushedDelta = new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0);
    return (
      updatedDelta ||
      pushedDelta ||
      (b.stargazers_count || 0) - (a.stargazers_count || 0) ||
      (b.commitCount || 0) - (a.commitCount || 0) ||
      a.full_name.localeCompare(b.full_name)
    );
  });
}

export function decodeBase64(content = '') {
  return Buffer.from(content.replace(/\n/g, ''), 'base64').toString('utf8');
}

export function extractUrls(value = '') {
  return [...String(value).matchAll(/https?:\/\/[^\s)\]>"]+/g)]
    .map((match) => match[0].replace(/[.,;:!?]+$/g, ''));
}
