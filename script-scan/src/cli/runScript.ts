import { spawn } from 'child_process';

export async function runScript(scriptName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('bun', ['run', scriptName], {
      stdio: 'inherit',
      shell: true,
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
