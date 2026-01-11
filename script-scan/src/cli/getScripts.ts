import { readFile, readdir, stat } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { existsSync } from 'fs';
import type { ScriptInfo } from './interfaces';
import { getCachedScripts, setCachedScripts } from './cache';

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

async function findMonorepoRoot(startDir: string): Promise<string | null> {
  let currentDir = startDir;

  while (currentDir !== '/') {
    const packagePath = join(currentDir, 'package.json');
    if (existsSync(packagePath)) {
      try {
        const content = await readFile(packagePath, 'utf-8');
        const pkg = JSON.parse(content);
        // Check for workspaces (npm/yarn) or pnpm-workspace.yaml
        if (pkg.workspaces) {
          return currentDir;
        }
      } catch {
        // Continue searching
      }
      // Also check for pnpm-workspace.yaml
      if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
        return currentDir;
      }
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

async function findAllPackageJsons(
  rootDir: string,
  baseDir: string = rootDir
): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, .git, and other common non-workspace dirs
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === '.github' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === '.next' ||
          entry.name === 'coverage'
        ) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.name === 'package.json') {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

function getPackageDisplayName(
  packagePath: string,
  monorepoRoot: string
): string {
  const packageDir = dirname(packagePath);
  const relativePath = relative(monorepoRoot, packageDir);

  if (!relativePath) {
    return '(root)';
  }

  return relativePath;
}

async function parsePackageJson(
  packagePath: string,
  monorepoRoot?: string
): Promise<ScriptInfo[]> {
  try {
    const content = await readFile(packagePath, 'utf-8');
    const packageJson = JSON.parse(content);

    if (!packageJson.scripts || typeof packageJson.scripts !== 'object') {
      return [];
    }

    const packageDir = dirname(packagePath);
    const packageName = monorepoRoot
      ? getPackageDisplayName(packagePath, monorepoRoot)
      : undefined;

    const scripts: ScriptInfo[] = Object.entries(packageJson.scripts).map(
      ([name, command]) => ({
        name,
        command: command as string,
        packageName,
        packagePath: monorepoRoot ? packageDir : undefined,
      })
    );

    return scripts;
  } catch (err) {
    console.error(`Failed to read ${packagePath}:`, err);
    return [];
  }
}

export interface GetScriptsOptions {
  workspaces?: boolean;
}

export async function getScripts(
  options: GetScriptsOptions = {}
): Promise<ScriptInfo[]> {
  const cwd = process.cwd();

  if (options.workspaces) {
    // Monorepo mode: find all package.json files
    const monorepoRoot = await findMonorepoRoot(cwd);

    if (!monorepoRoot) {
      console.error(
        'No monorepo root found (no workspaces config or pnpm-workspace.yaml).'
      );
      console.error('Falling back to single package.json mode.');
      return getScripts({ workspaces: false });
    }

    const packageJsonPaths = await findAllPackageJsons(monorepoRoot);

    if (packageJsonPaths.length === 0) {
      console.error('No package.json files found in monorepo.');
      return [];
    }

    // Check cache
    const cacheKey = `workspaces:${monorepoRoot}`;
    const cached = await getCachedScripts(cacheKey, packageJsonPaths);
    if (cached) {
      return cached;
    }

    const allScripts: ScriptInfo[] = [];

    for (const pkgPath of packageJsonPaths) {
      const scripts = await parsePackageJson(pkgPath, monorepoRoot);
      allScripts.push(...scripts);
    }

    if (allScripts.length === 0) {
      console.error('No scripts found in any package.json files.');
      return [];
    }

    // Sort by package name, then script name
    allScripts.sort((a, b) => {
      const pkgCompare = (a.packageName || '').localeCompare(
        b.packageName || ''
      );
      if (pkgCompare !== 0) return pkgCompare;
      return a.name.localeCompare(b.name);
    });

    // Update cache
    await setCachedScripts(cacheKey, allScripts, packageJsonPaths);

    return allScripts;
  }

  // Single package mode (original behavior)
  try {
    const packagePath = await findPackageJson(cwd);

    if (!packagePath) {
      console.error(
        'No package.json found in current directory or any parent directory.'
      );
      return [];
    }

    // Check cache
    const cacheKey = `single:${packagePath}`;
    const cached = await getCachedScripts(cacheKey, [packagePath]);
    if (cached) {
      return cached;
    }

    const scripts = await parsePackageJson(packagePath);

    // Update cache
    await setCachedScripts(cacheKey, scripts, [packagePath]);

    return scripts;
  } catch (err) {
    console.error('Failed to read package.json:', err);
    return [];
  }
}
