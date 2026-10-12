#!/usr/bin/env bun
import { program } from 'commander';
import { interactiveScriptRunner } from './interactiveScriptRunner';

program
  .name('script-scan')
  .description('Interactive npm script runner')
  .version('1.0.0')
  .option('-w, --workspaces', 'Scan all workspace packages in monorepo')
  .option('-l, --limit <number>', 'Limit number of scripts shown in list', parseInt)
  .action((options) => interactiveScriptRunner(options));

program.parse();
