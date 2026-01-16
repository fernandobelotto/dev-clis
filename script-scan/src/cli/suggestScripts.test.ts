import { describe, expect, test } from 'bun:test';
import { suggestScripts } from './suggestScripts';
import type { EnquirerChoice } from './interfaces';

const createChoice = (
  name: string,
  command: string,
  packageName?: string
): EnquirerChoice => ({
  name,
  value: name,
  message: name,
  command,
  source: 'npm',
  packageName,
});

const sampleChoices: EnquirerChoice[] = [
  createChoice('build', 'tsc && rollup -c'),
  createChoice('dev', 'vite dev'),
  createChoice('test', 'vitest'),
  createChoice('test:watch', 'vitest --watch'),
  createChoice('lint', 'eslint src'),
  createChoice('typecheck', 'tsc --noEmit'),
  createChoice('start', 'node dist/index.js'),
];

describe('suggestScripts', () => {
  describe('empty input', () => {
    test('returns all choices when input is empty string', () => {
      const result = suggestScripts(sampleChoices, '');
      expect(result).toEqual(sampleChoices);
    });

    test('returns all choices when input is whitespace', () => {
      const result = suggestScripts(sampleChoices, '   ');
      expect(result).toEqual(sampleChoices);
    });

    test('returns all choices when input is undefined/null-like', () => {
      const result = suggestScripts(sampleChoices, undefined as any);
      expect(result).toEqual(sampleChoices);
    });
  });

  describe('exact match', () => {
    test('returns choice when input exactly matches script name', () => {
      const result = suggestScripts(sampleChoices, 'build');
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('build');
    });

    test('exact match is case-insensitive', () => {
      const result = suggestScripts(sampleChoices, 'BUILD');
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('build');
    });
  });

  describe('partial match on name', () => {
    test('matches scripts containing search term in name', () => {
      const result = suggestScripts(sampleChoices, 'test');
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.name)).toContain('test');
      expect(result.map((c) => c.name)).toContain('test:watch');
    });

    test('partial match is case-insensitive', () => {
      const result = suggestScripts(sampleChoices, 'TEST');
      expect(result).toHaveLength(2);
    });
  });

  describe('partial match on command', () => {
    test('matches scripts when search term is in command', () => {
      const result = suggestScripts(sampleChoices, 'vite');
      // 'vite' matches: dev (vite dev), test (vitest), test:watch (vitest --watch)
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.name)).toContain('dev');
      expect(result.map((c) => c.name)).toContain('test');
      expect(result.map((c) => c.name)).toContain('test:watch');
    });

    test('command match is case-insensitive', () => {
      const result = suggestScripts(sampleChoices, 'TSC');
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.name)).toContain('build');
      expect(result.map((c) => c.name)).toContain('typecheck');
    });
  });

  describe('multi-term AND matching', () => {
    test('requires all space-separated terms to match', () => {
      const result = suggestScripts(sampleChoices, 'test watch');
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('test:watch');
    });

    test('terms can match across name and command', () => {
      const result = suggestScripts(sampleChoices, 'dev vite');
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('dev');
    });

    test('returns empty when not all terms match', () => {
      const result = suggestScripts(sampleChoices, 'test rollup');
      expect(result).toHaveLength(0);
    });

    test('handles multiple spaces between terms', () => {
      const result = suggestScripts(sampleChoices, 'test   watch');
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('test:watch');
    });
  });

  describe('no matches', () => {
    test('returns empty array when no scripts match', () => {
      const result = suggestScripts(sampleChoices, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('empty choices', () => {
    test('returns empty array when choices is empty', () => {
      const result = suggestScripts([], 'test');
      expect(result).toHaveLength(0);
    });
  });
});
