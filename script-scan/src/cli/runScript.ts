import { spawn } from 'child_process';
import { detectPackageManager } from './detectPackageManager';
import type { ScriptSource } from './interfaces';

export async function runScript(
  scriptName: string,
  cwd?: string,
  source: ScriptSource = 'npm'
): Promise<boolean> {
  const workingDir = cwd || process.cwd();

  return new Promise((resolve) => {
    let child;

    if (source === 'make') {
      child = spawn('make', [scriptName], {
        stdio: 'inherit',
        shell: true,
        cwd: workingDir,
      });
    } else {
      const pm = detectPackageManager(workingDir);
      child = spawn(pm, ['run', scriptName], {
        stdio: 'inherit',
        shell: true,
        cwd: workingDir,
      });
    }

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', (err) => {
      console.error(`Failed to run ${source === 'make' ? 'target' : 'script'} "${scriptName}":`, err);
      resolve(false);
    });
  });
}
