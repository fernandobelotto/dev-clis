#!/usr/bin/env bun
import { getAllCommands } from './db.js';
import { writeFileSync } from 'fs';
import { Command } from 'commander';

const program = new Command();

program
  .name('cmdlog export')
  .description('Export command logs to JSON or CSV format')
  .option('-f, --format <format>', 'output format (json or csv)', 'json')
  .option('-o, --output <file>', 'output file (if not specified, writes to stdout)')
  .parse(process.argv);

const options = program.opts();

function main() {
  const commands = getAllCommands();
  
  if (commands.length === 0) {
    console.error('No commands to export');
    process.exit(0);
  }
  
  // Initialize output with a default empty string
  let output = '';
  
  switch (options.format.toLowerCase()) {
    case 'json':
      output = JSON.stringify(commands, null, 2);
      break;
    case 'csv':
      // CSV header
      output = 'id,timestamp,directory,command\n';
      // CSV rows
      output += commands.map(cmd => {
        return `${cmd.id},${cmd.timestamp},"${cmd.directory.replace(/"/g, '""')}","${cmd.command.replace(/"/g, '""')}"`;
      }).join('\n');
      break;
    default:
      console.error(`Unsupported format: ${options.format}. Use 'json' or 'csv'.`);
      process.exit(1);
  }
  
  if (options.output) {
    try {
      writeFileSync(options.output, output);
      console.log(`Exported ${commands.length} commands to ${options.output}`);
    } catch (error) {
      console.error(`Failed to write to ${options.output}:`, error);
      process.exit(1);
    }
  } else {
    // Write to stdout
    console.log(output);
  }
}

main(); 