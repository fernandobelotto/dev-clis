#!/usr/bin/env bun
import { program } from 'commander';
import { interactiveScriptRunner } from './interactiveScriptRunner';

program
  .name('script-scan')
  .description('Interactive npm script runner')
  .version('1.0.0')
  .option('-m, --multi', 'Allow multiple script selection')
  .option('-w, --workspaces', 'Scan all workspace packages in monorepo')
  .action((options) => interactiveScriptRunner(options));

program.parse();
