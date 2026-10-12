#!/usr/bin/env bun
import { logCommand } from './db.js';

async function main() {
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
}

// Run the main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
}); 