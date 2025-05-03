#!/usr/bin/env bun
import { cleanOldCommands } from './db.js';
import { Command } from 'commander';

const program = new Command();

program
  .name('shellmemory clean')
  .description('Clean old command log entries')
  .option('-o, --older-than <period>', 'delete entries older than specified period (e.g., 30d, 24h)', '30d')
  .parse(process.argv);

const options = program.opts();

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

function main() {
  const threshold = parsePeriod(options.olderThan);
  
  try {
    const deleted = cleanOldCommands(threshold);
    console.log(`Successfully cleaned ${deleted} commands older than ${options.olderThan}`);
  } catch (error) {
    console.error('Failed to clean old commands:', error);
    process.exit(1);
  }
}

main(); 