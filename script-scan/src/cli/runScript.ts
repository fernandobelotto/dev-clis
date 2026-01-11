import { spawn } from 'child_process';
import { detectPackageManager } from './detectPackageManager';

export async function runScript(
  scriptName: string,
  cwd?: string
): Promise<boolean> {
  const workingDir = cwd || process.cwd();
  const pm = detectPackageManager(workingDir);

  return new Promise((resolve) => {
    const child = spawn(pm, ['run', scriptName], {
      stdio: 'inherit',
      shell: true,
      cwd: workingDir,
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', (err) => {
      console.error(`Failed to run script "${scriptName}":`, err);
      resolve(false);
    });
  });
}
