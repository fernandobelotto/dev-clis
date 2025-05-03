#!/usr/bin/env bun
import { getTopCommands, getCommandsByHour } from './db.js';
import chalk from 'chalk';

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

function main() {
  console.log(chalk.bold.blue('\n📊 CMDLOG STATISTICS'));
  console.log(chalk.dim('==================='));
  
  displayTopCommands();
  displayHourlyDistribution();
  
  console.log('\n');
}

main(); 