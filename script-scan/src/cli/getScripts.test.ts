import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { getScripts } from './getScripts';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const createTempDir = (): string => {
  const tempDir = join(tmpdir(), `script-scan-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
};

const writePackageJson = (dir: string, content: object): void => {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(content, null, 2));
};

describe('getScripts', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('single package mode', () => {
    test('reads scripts from package.json in current directory', async () => {
      writePackageJson(tempDir, {
        name: 'test-package',
        scripts: {
          build: 'tsc',
          test: 'vitest',
          dev: 'vite dev',
        },
      });

      process.chdir(tempDir);
      const scripts = await getScripts();

      expect(scripts).toHaveLength(3);
      expect(scripts.map((s) => s.name).sort()).toEqual(['build', 'dev', 'test']);
    });

    test('returns script command correctly', async () => {
      writePackageJson(tempDir, {
        name: 'test-package',
        scripts: {
          build: 'tsc && rollup -c',
        },
      });

      process.chdir(tempDir);
      const scripts = await getScripts();

      expect(scripts).toHaveLength(1);
      expect(scripts[0]!.name).toBe('build');
      expect(scripts[0]!.command).toBe('tsc && rollup -c');
    });

    test('returns empty array when package.json has no scripts', async () => {
      writePackageJson(tempDir, {
        name: 'test-package',
      });

      process.chdir(tempDir);
      const scripts = await getScripts();

      expect(scripts).toHaveLength(0);
    });

    test('returns empty array when scripts is empty object', async () => {
      writePackageJson(tempDir, {
        name: 'test-package',
        scripts: {},
      });

      process.chdir(tempDir);
      const scripts = await getScripts();

      expect(scripts).toHaveLength(0);
    });

    test('finds package.json in parent directory', async () => {
      const subDir = join(tempDir, 'src', 'components');
      mkdirSync(subDir, { recursive: true });

      writePackageJson(tempDir, {
        name: 'test-package',
        scripts: {
          build: 'tsc',
        },
      });

      process.chdir(subDir);
      const scripts = await getScripts();

      expect(scripts).toHaveLength(1);
      expect(scripts[0]!.name).toBe('build');
    });

    test('returns empty array when no package.json is found', async () => {
      const emptyDir = join(tempDir, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      // Create a directory structure without package.json
      // We need to ensure we don't traverse into the project's own package.json
      const isolatedDir = join(tmpdir(), `isolated-test-${Date.now()}`);
      mkdirSync(isolatedDir, { recursive: true });

      process.chdir(isolatedDir);
      const scripts = await getScripts();

      expect(scripts).toHaveLength(0);

      rmSync(isolatedDir, { recursive: true, force: true });
    });
  });

  describe('monorepo/workspace mode', () => {
    test('finds scripts in all workspace packages', async () => {
      // Create root with workspaces config
      writePackageJson(tempDir, {
        name: 'monorepo-root',
        workspaces: ['packages/*'],
        scripts: {
          'root-script': 'echo root',
        },
      });

      // Create package A
      const packageA = join(tempDir, 'packages', 'package-a');
      mkdirSync(packageA, { recursive: true });
      writePackageJson(packageA, {
        name: '@monorepo/package-a',
        scripts: {
          build: 'tsc',
          test: 'vitest',
        },
      });

      // Create package B
      const packageB = join(tempDir, 'packages', 'package-b');
      mkdirSync(packageB, { recursive: true });
      writePackageJson(packageB, {
        name: '@monorepo/package-b',
        scripts: {
          dev: 'vite',
          lint: 'eslint',
        },
      });

      process.chdir(tempDir);
      const scripts = await getScripts({ workspaces: true });

      expect(scripts.length).toBeGreaterThanOrEqual(5);

      const scriptNames = scripts.map((s) => s.name);
      expect(scriptNames).toContain('root-script');
      expect(scriptNames).toContain('build');
      expect(scriptNames).toContain('test');
      expect(scriptNames).toContain('dev');
      expect(scriptNames).toContain('lint');
    });

    test('includes package name in script info for workspace packages', async () => {
      writePackageJson(tempDir, {
        name: 'monorepo-root',
        workspaces: ['packages/*'],
      });

      const packageA = join(tempDir, 'packages', 'my-package');
      mkdirSync(packageA, { recursive: true });
      writePackageJson(packageA, {
        name: '@monorepo/my-package',
        scripts: {
          build: 'tsc',
        },
      });

      process.chdir(tempDir);
      const scripts = await getScripts({ workspaces: true });

      const buildScript = scripts.find(
        (s) => s.name === 'build' && s.packageName?.includes('my-package')
      );
      expect(buildScript).toBeDefined();
      expect(buildScript?.packageName).toBe('packages/my-package');
    });

    test('excludes node_modules directories', async () => {
      writePackageJson(tempDir, {
        name: 'monorepo-root',
        workspaces: ['packages/*'],
        scripts: {
          'root-script': 'echo root',
        },
      });

      // Create a package in node_modules (should be ignored)
      const nodeModulesPkg = join(tempDir, 'node_modules', 'some-dep');
      mkdirSync(nodeModulesPkg, { recursive: true });
      writePackageJson(nodeModulesPkg, {
        name: 'some-dep',
        scripts: {
          'dep-script': 'echo dep',
        },
      });

      // Create a real workspace package
      const realPackage = join(tempDir, 'packages', 'real-pkg');
      mkdirSync(realPackage, { recursive: true });
      writePackageJson(realPackage, {
        name: 'real-pkg',
        scripts: {
          build: 'tsc',
        },
      });

      process.chdir(tempDir);
      const scripts = await getScripts({ workspaces: true });

      const scriptNames = scripts.map((s) => s.name);
      expect(scriptNames).not.toContain('dep-script');
      expect(scriptNames).toContain('build');
    });

    test('detects pnpm-workspace.yaml as monorepo root', async () => {
      writePackageJson(tempDir, {
        name: 'pnpm-monorepo',
        scripts: {
          'root-script': 'echo root',
        },
      });

      // Create pnpm-workspace.yaml
      writeFileSync(
        join(tempDir, 'pnpm-workspace.yaml'),
        'packages:\n  - packages/*\n'
      );

      const packageA = join(tempDir, 'packages', 'pkg-a');
      mkdirSync(packageA, { recursive: true });
      writePackageJson(packageA, {
        name: 'pkg-a',
        scripts: {
          build: 'tsc',
        },
      });

      process.chdir(tempDir);
      const scripts = await getScripts({ workspaces: true });

      expect(scripts.length).toBeGreaterThanOrEqual(2);
      const scriptNames = scripts.map((s) => s.name);
      expect(scriptNames).toContain('root-script');
      expect(scriptNames).toContain('build');
    });

    test('falls back to single package mode when no monorepo config found', async () => {
      writePackageJson(tempDir, {
        name: 'single-package',
        scripts: {
          build: 'tsc',
        },
      });

      process.chdir(tempDir);
      const scripts = await getScripts({ workspaces: true });

      expect(scripts).toHaveLength(1);
      expect(scripts[0]!.name).toBe('build');
    });

    test('scripts are sorted by package name then script name', async () => {
      writePackageJson(tempDir, {
        name: 'monorepo-root',
        workspaces: ['packages/*'],
        scripts: {
          'z-script': 'echo z',
          'a-script': 'echo a',
        },
      });

      const packageZ = join(tempDir, 'packages', 'z-package');
      mkdirSync(packageZ, { recursive: true });
      writePackageJson(packageZ, {
        name: 'z-package',
        scripts: {
          'b-script': 'echo b',
          'a-script': 'echo a',
        },
      });

      const packageA = join(tempDir, 'packages', 'a-package');
      mkdirSync(packageA, { recursive: true });
      writePackageJson(packageA, {
        name: 'a-package',
        scripts: {
          build: 'tsc',
        },
      });

      process.chdir(tempDir);
      const scripts = await getScripts({ workspaces: true });

      // Root package comes first (empty relative path), then a-package, then z-package
      const rootScripts = scripts.filter((s) => s.packageName === '(root)');
      const aPackageScripts = scripts.filter(
        (s) => s.packageName === 'packages/a-package'
      );
      const zPackageScripts = scripts.filter(
        (s) => s.packageName === 'packages/z-package'
      );

      expect(rootScripts.length).toBeGreaterThan(0);
      expect(aPackageScripts.length).toBeGreaterThan(0);
      expect(zPackageScripts.length).toBeGreaterThan(0);

      // Within z-package, scripts should be sorted alphabetically
      const zScriptNames = zPackageScripts.map((s) => s.name);
      expect(zScriptNames).toEqual(['a-script', 'b-script']);
    });
  });
});
