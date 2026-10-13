import { spawn } from "node:child_process";

import { detectPackageManager } from "./detectPackageManager";
import type { ScriptSource } from "./interfaces";

export async function runScript(
  scriptName: string,
  cwd?: string,
  source: ScriptSource = "npm"
): Promise<boolean> {
  const workingDir = cwd || process.cwd();

  return new Promise((resolve) => {
    let child;

    if (source === "make") {
      child = spawn("make", [scriptName], {
        cwd: workingDir,
        shell: true,
        stdio: "inherit",
      });
    } else {
      const pm = detectPackageManager(workingDir);
      child = spawn(pm, ["run", scriptName], {
        cwd: workingDir,
        shell: true,
        stdio: "inherit",
      });
    }

    child.on("close", (code) => {
      resolve(code === 0);
    });

    child.on("error", (err) => {
      console.error(
        `Failed to run ${source === "make" ? "target" : "script"} "${scriptName}":`,
        err
      );
      resolve(false);
    });
  });
}
