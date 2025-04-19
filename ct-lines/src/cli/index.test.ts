import { expect, test } from 'bun:test';
import { join } from 'path';

// Adjust this path to a directory you want to test, e.g., the src directory itself
const CLI_PATH = join(import.meta.dir, 'index.ts');
const TEST_DIR = join(import.meta.dir, '../..'); // project root or adjust as needed

test('ct-lines CLI runs and outputs summary', async () => {
  const proc = Bun.spawn({
    cmd: ['bun', CLI_PATH, TEST_DIR, '--generate-results', 'false'],
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const output = await new Response(proc.stdout).text();
  const error = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  expect(exitCode).toBe(0);
  expect(output).toContain('ct-lines'); // Should contain the CLI name or summary
  expect(error === '' || error === '\n').toBe(true);
});

