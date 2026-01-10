import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import type { ScriptInfo } from './interfaces';

async function findPackageJson(startDir: string): Promise<string | null> {
  let currentDir = startDir;

  while (currentDir !== '/') {
    const packagePath = join(currentDir, 'package.json');
    if (existsSync(packagePath)) {
      return packagePath;
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

export async function getScripts(): Promise<ScriptInfo[]> {
  try {
    const cwd = process.cwd();
    const packagePath = await findPackageJson(cwd);

    if (!packagePath) {
      console.error('No package.json found in current directory or any parent directory.');
      return [];
    }

    const content = await readFile(packagePath, 'utf-8');
    const packageJson = JSON.parse(content);

    if (!packageJson.scripts || typeof packageJson.scripts !== 'object') {
      console.error('No scripts found in package.json.');
      return [];
    }

    const scripts: ScriptInfo[] = Object.entries(packageJson.scripts).map(
      ([name, command]) => ({
        name,
        command: command as string,
      })
    );

    return scripts;
  } catch (err) {
    console.error('Failed to read package.json:', err);
    return [];
  }
}
