import { test, expect, describe } from 'bun:test';
import { TextTableFormatter } from '../TextTableFormatter';
import { MarkdownTableFormatter } from '../MarkdownTableFormatter';
import { ResultFormatter } from '../ResultFormatter';
import { Count } from '../../models/Count';
import { TokenCount } from '../../lib/TokenCounter';


describe('Formatters', () => {
    test('TextTableFormatter basic usage', () => {
      const formatter = new TextTableFormatter(
        (v) => v.toString(),
        { title: 'Name', width: 8 },
        { title: 'Value', width: 5 }
      );
      const header = formatter.headerLines.join('\n');
      const line = formatter.line('foo', 123);
      expect(header).toContain('Name');
      expect(header).toContain('Value');
      expect(line).toContain('foo');
      expect(line).toContain('123');
    });
  
    test('MarkdownTableFormatter basic usage', () => {
      const formatter = new MarkdownTableFormatter(
        (v) => v.toString(),
        { title: 'Name', format: 'string' },
        { title: 'Value', format: 'number' }
      );
      const header = formatter.headerLines.join('\n');
      const line = formatter.line('foo', 123);
      expect(header).toContain('Name');
      expect(header).toContain('Value');
      expect(line).toContain('foo');
      expect(line).toContain('123');
    });
  
    test('ResultFormatter toText, toJson, toCsv, toFilesCsv, toDirectoriesCsv, toMarkdown', () => {
      // Minimal mock data
      const results = [
        {
          filePath: 'src/foo.ts',
          language: 'TypeScript',
          count: Object.assign(new Count(), { code: 10, comment: 2, blank: 1, total: 13 }),
          tokenCount: new TokenCount(42)
        },
        {
          filePath: 'src/bar.js',
          language: 'JavaScript',
          count: Object.assign(new Count(), { code: 5, comment: 1, blank: 0, total: 6 }),
          tokenCount: new TokenCount(21)
        }
      ];
      const formatter = new ResultFormatter(
        '.',
        results,
        { printCommas: false, countDirectLevelFiles: false }
      );
  
      // toText
      const text = formatter.toText();
      expect(text).toContain('Languages');
      expect(text).toContain('TypeScript');
      expect(text).toContain('JavaScript');
      expect(text).toContain('foo.ts');
      expect(text).toContain('bar.js');
  
      // toJson
      const json = formatter.toJson();
      expect(json).toContain('TypeScript');
      expect(json).toContain('JavaScript');
      expect(json).toContain('foo.ts');
      expect(json).toContain('bar.js');
      expect(json).toContain('"code": 10');
      expect(json).toContain('"tokens": 42');
  
      // toCsv
      const csv = formatter.toCsv();
      expect(csv).toContain('filename');
      expect(csv).toContain('TypeScript');
      expect(csv).toContain('JavaScript');
      expect(csv).toContain('foo.ts');
      expect(csv).toContain('bar.js');
  
      // toFilesCsv
      const filesCsv = formatter.toFilesCsv();
      expect(filesCsv).toContain('foo.ts');
      expect(filesCsv).toContain('bar.js');
      expect(filesCsv).toContain('code');
      expect(filesCsv).toContain('tokens');
  
      // toDirectoriesCsv
      const dirCsv = formatter.toDirectoriesCsv();
      expect(dirCsv).toContain('path');
      expect(dirCsv).toContain('files');
      expect(dirCsv).toContain('code');
      expect(dirCsv).toContain('tokens');
  
      // toMarkdown (summary)
      const md = formatter.toMarkdown();
      expect(md).toContain('# Summary');
      expect(md).toContain('Languages');
      expect(md).toContain('TypeScript');
      expect(md).toContain('JavaScript');
  
      // toMarkdown (details)
      const mdDetails = formatter.toMarkdown(true);
      expect(mdDetails).toContain('# Details');
      expect(mdDetails).toContain('foo.ts');
      expect(mdDetails).toContain('bar.js');
    });
  }); 