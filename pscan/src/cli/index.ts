#!/usr/bin/env bun
import { program } from 'commander';
import { interactivePortKiller } from './interactivePortKiller';

program
  .name('pscan')
  .description('Interactive port scanner and killer')
  .version('1.0.0')
  .action(interactivePortKiller);

program.parse(); 