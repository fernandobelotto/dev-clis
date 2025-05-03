#!/usr/bin/env bun
import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { logCommand, getTopCommands, getCommandsByHour, getAllCommands, cleanOldCommands, searchCommands } from './cli/db.js';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { format } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('tlogger')
  .description('Terminal command logger that records commands to SQLite')
  .version('1.0.0');

// Add a log command that reads from stdin
program
  .command('log')
  .description('Log a command from stdin (used by shell hooks)')
  .allowUnknownOption(true)
  .action(async () => {
    // Read from stdin
    const input = await Bun.stdin.text();
    
    // Validate and parse input format: timestamp|directory|command
    const parts = input.trim().split('|');
    
    if (parts.length < 3) {
      console.error('Invalid input format. Expected: timestamp|directory|command');
      process.exit(1);
    }
    
    const timestamp = parseInt(parts[0], 10);
    const directory = parts[1];
    const command = parts.slice(2).join('|'); // Join the rest in case command contains pipes
    
    if (isNaN(timestamp)) {
      console.error('Invalid timestamp format');
      process.exit(1);
    }
    
    try {
      logCommand(timestamp, directory, command);
    } catch (error) {
      console.error('Failed to log command:', error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show statistics about your command usage')
  .action(() => {
    // Display top commands
    function displayTopCommands() {
      const topCommands = getTopCommands();
      
      console.log(chalk.bold('\n🔝 Top 10 Most Used Commands:'));
      console.log(chalk.dim('-------------------------------'));
      
      if (topCommands.length === 0) {
        console.log(chalk.yellow('No commands logged yet.'));
        return;
      }
      
      const maxCount = Math.max(...topCommands.map(c => c.count));
      
      topCommands.forEach((cmd, index) => {
        const barLength = Math.ceil((cmd.count / maxCount) * 30);
        const bar = '█'.repeat(barLength);
        console.log(
          `${chalk.blue(String(index + 1).padStart(2))}. ${chalk.green(cmd.command.padEnd(30))} ${chalk.blue(bar)} ${chalk.yellow(cmd.count)}`
        );
      });
    }

    // Display hourly distribution
    function displayHourlyDistribution() {
      const hourlyData = getCommandsByHour();
      
      console.log(chalk.bold('\n⏰ Command Usage by Hour of Day:'));
      console.log(chalk.dim('--------------------------------'));
      
      if (hourlyData.length === 0) {
        console.log(chalk.yellow('No commands logged yet.'));
        return;
      }
      
      const maxCount = Math.max(...hourlyData.map(h => h.count));
      
      // Create array for all 24 hours
      const allHours = Array.from({ length: 24 }, (_, i) => {
        const existing = hourlyData.find(h => Number(h.hour) === i);
        return existing || { hour: i, count: 0 };
      });
      
      allHours.forEach(hour => {
        const barLength = Math.ceil((hour.count / maxCount) * 30);
        const bar = '█'.repeat(barLength);
        const hourDisplay = `${String(hour.hour).padStart(2, '0')}:00`;
        console.log(
          `${chalk.blue(hourDisplay)} ${chalk.green(bar)} ${chalk.yellow(hour.count)}`
        );
      });
    }

    console.log(chalk.bold.blue('\n📊 TLOGGER STATISTICS'));
    console.log(chalk.dim('==================='));
    
    displayTopCommands();
    displayHourlyDistribution();
    
    console.log('\n');
  });

program
  .command('export')
  .description('Export command history to JSON or CSV')
  .option('-f, --format <format>', 'output format (json or csv)', 'json')
  .option('-o, --output <file>', 'output file (if not specified, writes to stdout)')
  .action((options: { format?: string; output?: string }) => {
    const commands = getAllCommands();
    
    if (commands.length === 0) {
      console.error('No commands to export');
      process.exit(0);
    }
    
    // Initialize output with a default empty string
    let output = '';
    
    switch (options.format?.toLowerCase()) {
      case 'csv':
        // CSV header
        output = 'id,timestamp,directory,command\n';
        // CSV rows
        output += commands.map(cmd => {
          return `${cmd.id},${cmd.timestamp},"${cmd.directory.replace(/"/g, '""')}","${cmd.command.replace(/"/g, '""')}"`;
        }).join('\n');
        break;
      case 'json':
      default:
        output = JSON.stringify(commands, null, 2);
        break;
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
  });

program
  .command('clean')
  .description('Clean old command entries')
  .option('-o, --older-than <period>', 'delete entries older than specified period (e.g., 30d, 24h)', '30d')
  .action((options: { olderThan?: string }) => {
    // Parse time period like "30d" or "24h" into seconds
    function parsePeriod(period: string): number {
      const match = period.match(/^(\d+)([dhm])$/);
      
      if (!match) {
        console.error('Invalid period format. Use format like 30d, 24h, or 60m');
        process.exit(1);
        // This will never be reached due to process.exit, but needed for TypeScript
        return 0;
      }
      
      const value = parseInt(match[1], 10);
      const unit = match[2];
      
      const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
      
      switch (unit) {
        case 'd': // days
          return now - (value * 24 * 60 * 60);
        case 'h': // hours
          return now - (value * 60 * 60);
        case 'm': // minutes
          return now - (value * 60);
        default:
          console.error('Invalid time unit. Use d (days), h (hours), or m (minutes)');
          process.exit(1);
          // This will never be reached due to process.exit, but needed for TypeScript
          return 0;
      }
    }
    
    const threshold = parsePeriod(options.olderThan || '30d');
    
    try {
      const deleted = cleanOldCommands(threshold);
      console.log(`Successfully cleaned ${deleted} commands older than ${options.olderThan || '30d'}`);
    } catch (error) {
      console.error('Failed to clean old commands:', error);
      process.exit(1);
    }
  });

// Add search command from the previously separate CLI file
program
  .command('search <query>')
  .description('Search for commands containing the specified text')
  .option('-a, --all', 'Display all matching results instead of just the first 10')
  .action((query, options) => {
    console.log(chalk.bold(`Searching for commands containing "${query}"...\n`));
    
    try {
      const allResults = searchCommands(query);
      
      if (allResults.length === 0) {
        console.log(chalk.yellow('No matching commands found.'));
        return;
      }
      
      // Determine how many results to display
      const displayResults = options.all ? allResults : allResults.slice(0, 10);
      
      // Format and display the results
      displayResults.forEach(result => {
        const date = format(new Date(result.timestamp * 1000), 'yyyy-MM-dd HH:mm:ss');
        
        // Highlight the matching part of the command
        let highlightedCommand = result.command;
        if (query) {
          const regex = new RegExp(query, 'gi');
          highlightedCommand = result.command.replace(regex, match => chalk.bold.yellow(match));
        }
        
        console.log(`${chalk.blue(date)} ${chalk.gray('[' + result.directory + ']')}`);
        console.log(`  ${highlightedCommand}`);
        console.log();
      });
      
      // Show pagination info if applicable
      if (!options.all && allResults.length > 10) {
        console.log(chalk.dim(`Showing 10 of ${allResults.length} results. Use --all flag to show all results.`));
      }
      
      console.log(chalk.bold(`Found ${allResults.length} command${allResults.length === 1 ? '' : 's'} matching "${query}"`));
    } catch (error) {
      console.error(chalk.red('Error searching commands:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 