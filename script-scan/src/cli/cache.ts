import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { ScriptInfo } from './interfaces';

const CACHE_DIR = join(homedir(), '.cache', 'script-scan');
const CACHE_FILE = join(CACHE_DIR, 'scripts.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours max TTL

interface CacheEntry {
  scripts: ScriptInfo[];
  mtimes: Record<string, number>;
  timestamp: number;
}

interface CacheData {
  version: number;
  entries: Record<string, CacheEntry>;
}

async function ensureCacheDir(): Promise<void> {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }
}

async function readCache(): Promise<CacheData> {
  try {
    if (!existsSync(CACHE_FILE)) {
      return { version: 1, entries: {} };
    }
    const content = await readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { version: 1, entries: {} };
  }
}

async function writeCache(data: CacheData): Promise<void> {
  try {
    await ensureCacheDir();
    await writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Silently fail - caching is optional
  }
}

export async function getMtimes(
  packageJsonPaths: string[]
): Promise<Record<string, number>> {
  const mtimes: Record<string, number> = {};
  for (const path of packageJsonPaths) {
    try {
      const stats = await stat(path);
      mtimes[path] = stats.mtimeMs;
    } catch {
      mtimes[path] = 0;
    }
  }
  return mtimes;
}

function mtimesMatch(
  cached: Record<string, number>,
  current: Record<string, number>
): boolean {
  const cachedKeys = Object.keys(cached).sort();
  const currentKeys = Object.keys(current).sort();

  if (cachedKeys.length !== currentKeys.length) {
    return false;
  }

  for (let i = 0; i < cachedKeys.length; i++) {
    const cachedKey = cachedKeys[i]!;
    const currentKey = currentKeys[i]!;
    if (cachedKey !== currentKey) {
      return false;
    }
    if (cached[cachedKey] !== current[currentKey]) {
      return false;
    }
  }

  return true;
}

export async function getCachedScripts(
  cacheKey: string,
  packageJsonPaths: string[]
): Promise<ScriptInfo[] | null> {
  const cache = await readCache();
  const entry = cache.entries[cacheKey];

  if (!entry) {
    return null;
  }

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    return null;
  }

  // Check mtimes
  const currentMtimes = await getMtimes(packageJsonPaths);
  if (!mtimesMatch(entry.mtimes, currentMtimes)) {
    return null;
  }

  return entry.scripts;
}

export async function setCachedScripts(
  cacheKey: string,
  scripts: ScriptInfo[],
  packageJsonPaths: string[]
): Promise<void> {
  const cache = await readCache();
  const mtimes = await getMtimes(packageJsonPaths);

  cache.entries[cacheKey] = {
    scripts,
    mtimes,
    timestamp: Date.now(),
  };

  // Clean old entries (keep max 50)
  const keys = Object.keys(cache.entries);
  if (keys.length > 50) {
    const sorted = keys.sort(
      (a, b) => (cache.entries[a]?.timestamp ?? 0) - (cache.entries[b]?.timestamp ?? 0)
    );
    for (let i = 0; i < keys.length - 50; i++) {
      const keyToDelete = sorted[i];
      if (keyToDelete) {
        delete cache.entries[keyToDelete];
      }
    }
  }

  await writeCache(cache);
}

export async function clearCache(): Promise<void> {
  await writeCache({ version: 1, entries: {} });
}
