import { readFile, readdir, stat } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { existsSync } from 'fs';
import type { ScriptInfo } from './interfaces';
import { getCachedScripts, setCachedScripts } from './cache';

const MAKEFILE_NAMES = ['Makefile', 'makefile', 'GNUmakefile'];

async function findMakefile(startDir: string): Promise<string | null> {
  let currentDir = startDir;

  while (currentDir !== '/') {
    for (const name of MAKEFILE_NAMES) {
      const makefilePath = join(currentDir, name);
      if (existsSync(makefilePath)) {
        return makefilePath;
      }
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
        if (pkg.workspaces) {
          return currentDir;
        }
      } catch {
        // Continue searching
      }
      if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
        return currentDir;
      }
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

async function findAllMakefiles(
  rootDir: string
): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
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
      } else if (MAKEFILE_NAMES.includes(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

function getPackageDisplayName(
  makefilePath: string,
  monorepoRoot: string
): string {
  const makefileDir = dirname(makefilePath);
  const relativePath = relative(monorepoRoot, makefileDir);

  if (!relativePath) {
    return '(root)';
  }

  return relativePath;
}

async function parseMakefile(
  makefilePath: string,
  monorepoRoot?: string
): Promise<ScriptInfo[]> {
  try {
    const content = await readFile(makefilePath, 'utf-8');
    const makefileDir = dirname(makefilePath);
    const packageName = monorepoRoot
      ? getPackageDisplayName(makefilePath, monorepoRoot)
      : undefined;

    const targets: ScriptInfo[] = [];
    const seen = new Set<string>();

    // Match target definitions: "target: [dependencies]"
    // Skip special targets starting with . (like .PHONY, .DEFAULT)
    const targetRegex = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm;
    let match;

    while ((match = targetRegex.exec(content)) !== null) {
      const targetName = match[1]!;

      // Skip if already seen (avoid duplicates)
      if (seen.has(targetName)) continue;
      seen.add(targetName);

      // Get the recipe/command for this target (lines after target that start with tab)
      const targetStart = match.index + match[0].length;
      const restOfContent = content.slice(targetStart);
      const lines = restOfContent.split('\n');

      let command = '';
      for (const line of lines) {
        // Recipe lines start with a tab
        if (line.startsWith('\t')) {
          if (command) command += ' && ';
          command += line.trim();
        } else if (line.trim() && !line.startsWith('#')) {
          // Non-empty, non-comment line that doesn't start with tab = new target/variable
          break;
        }
      }

      targets.push({
        name: targetName,
        command: command || `make ${targetName}`,
        source: 'make',
        packageName,
        packagePath: monorepoRoot ? makefileDir : undefined,
      });
    }

    return targets;
  } catch (err) {
    console.error(`Failed to read ${makefilePath}:`, err);
    return [];
  }
}

export interface GetMakefileTargetsOptions {
  workspaces?: boolean;
}

export async function getMakefileTargets(
  options: GetMakefileTargetsOptions = {}
): Promise<ScriptInfo[]> {
  const cwd = process.cwd();

  if (options.workspaces) {
    const monorepoRoot = await findMonorepoRoot(cwd);

    if (!monorepoRoot) {
      // No monorepo, fall back to single makefile mode
      return getMakefileTargets({ workspaces: false });
    }

    const makefilePaths = await findAllMakefiles(monorepoRoot);

    if (makefilePaths.length === 0) {
      return [];
    }

    // Check cache
    const cacheKey = `make:workspaces:${monorepoRoot}`;
    const cached = await getCachedScripts(cacheKey, makefilePaths);
    if (cached) {
      return cached;
    }

    const allTargets: ScriptInfo[] = [];

    for (const mkPath of makefilePaths) {
      const targets = await parseMakefile(mkPath, monorepoRoot);
      allTargets.push(...targets);
    }

    // Sort by package name, then target name
    allTargets.sort((a, b) => {
      const pkgCompare = (a.packageName || '').localeCompare(
        b.packageName || ''
      );
      if (pkgCompare !== 0) return pkgCompare;
      return a.name.localeCompare(b.name);
    });

    await setCachedScripts(cacheKey, allTargets, makefilePaths);
    return allTargets;
  }

  // Single makefile mode
  try {
    const makefilePath = await findMakefile(cwd);

    if (!makefilePath) {
      return [];
    }

    // Check cache
    const cacheKey = `make:single:${makefilePath}`;
    const cached = await getCachedScripts(cacheKey, [makefilePath]);
    if (cached) {
      return cached;
    }

    const targets = await parseMakefile(makefilePath);

    await setCachedScripts(cacheKey, targets, [makefilePath]);
    return targets;
  } catch (err) {
    console.error('Failed to read Makefile:', err);
    return [];
  }
}
