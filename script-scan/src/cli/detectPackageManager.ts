import { existsSync } from 'fs';
import { join, dirname } from 'path';

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

interface LockfileConfig {
  file: string;
  pm: PackageManager;
}

const lockfiles: LockfileConfig[] = [
  { file: 'bun.lockb', pm: 'bun' },
  { file: 'bun.lock', pm: 'bun' },
  { file: 'pnpm-lock.yaml', pm: 'pnpm' },
  { file: 'yarn.lock', pm: 'yarn' },
  { file: 'package-lock.json', pm: 'npm' },
];

let cachedPM: PackageManager | null = null;
let cachedDir: string | null = null;

export function detectPackageManager(startDir: string): PackageManager {
  // Return cached result if checking same directory
  if (cachedDir === startDir && cachedPM) {
    return cachedPM;
  }

  let currentDir = startDir;

  while (currentDir !== '/') {
    for (const { file, pm } of lockfiles) {
      if (existsSync(join(currentDir, file))) {
        cachedDir = startDir;
        cachedPM = pm;
        return pm;
      }
    }
    currentDir = dirname(currentDir);
  }

  // Default to npm if no lockfile found
  cachedDir = startDir;
  cachedPM = 'npm';
  return 'npm';
}

export function clearPackageManagerCache(): void {
  cachedPM = null;
  cachedDir = null;
}
