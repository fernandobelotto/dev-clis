export async function killProcess(pid: string) {
    try {
      process.kill(Number(pid), 'SIGKILL');
      return true;
    } catch {
      return false;
    }
  }