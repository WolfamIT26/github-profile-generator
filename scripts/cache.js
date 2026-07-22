import crypto from 'node:crypto';
import path from 'node:path';
import { ensureDir, readJsonFile, writeJsonFile } from './utils.js';

const DEFAULT_TTL_MS = Number(process.env.GITHUB_CACHE_TTL_MS || 6 * 60 * 60 * 1000);

export class JsonCache {
  constructor({ rootDir, namespace = 'github-api', ttlMs = DEFAULT_TTL_MS } = {}) {
    this.enabled = process.env.GITHUB_CACHE === '0' ? false : true;
    this.ttlMs = ttlMs;
    this.cacheDir = path.join(rootDir || process.cwd(), '.cache', namespace);
  }

  async get(key) {
    if (!this.enabled) {
      return null;
    }

    const entry = await readJsonFile(this.filePath(key), null);
    if (!entry || Date.now() - entry.createdAt > this.ttlMs) {
      return null;
    }

    return entry.value;
  }

  async set(key, value) {
    if (!this.enabled) {
      return;
    }

    await ensureDir(this.cacheDir);
    await writeJsonFile(this.filePath(key), {
      createdAt: Date.now(),
      value
    });
  }

  filePath(key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }
}
