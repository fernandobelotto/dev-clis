#!/usr/bin/env bun
import { searchCommands } from './db.js';
import chalk from 'chalk';
import { program } from 'commander';
import { format } from 'date-fns';

function formatCommandResult(result: { timestamp: number; directory: string; command: string }, query: string) {
  const date = format(new Date(result.timestamp * 1000), 'yyyy-MM-dd HH:mm:ss');
  
  // Highlight the matching part of the command
  let highlightedCommand = result.command;
  if (query) {
    const regex = new RegExp(query, 'gi');
    highlightedCommand = result.command.replace(regex, match => chalk.bold.yellow(match));
  }
  
  return `${chalk.blue(date)} ${chalk.gray('[' + result.directory + ']')}\n  ${highlightedCommand}`;
}

program
  .name('shellmemory search')
  .description('Search for commands in your command history')
  .argument('<query>', 'Text to search for in commands')
  .action((query: string) => {
    console.log(chalk.bold(`Searching for commands containing "${query}"...\n`));
    
    try {
      const results = searchCommands(query);
      
      if (results.length === 0) {
        console.log(chalk.yellow('No matching commands found.'));
        return;
      }
      
      const output = results.map(result => formatCommandResult(result, query)).join('\n\n');
      console.log(output);
      
      console.log(chalk.bold(`\nFound ${results.length} command${results.length === 1 ? '' : 's'} matching "${query}"`));
    } catch (error) {
      console.error('Error searching commands:', error);
      process.exit(1);
    }
  });

program.parse(); 