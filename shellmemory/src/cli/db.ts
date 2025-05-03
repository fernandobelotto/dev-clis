import { Database } from 'bun:sqlite';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';

// Ensure tlogger directory exists in user's home directory
const tloggerDir = join(homedir(), '.tlogger');
if (!existsSync(tloggerDir)) {
  mkdirSync(tloggerDir, { recursive: true });
}

const dbPath = join(tloggerDir, 'commands.db');

// Function to get a new database connection
function getConnection(): Database {
  const connection = new Database(dbPath, { create: true });
  // Set busy timeout to 5000ms (5 seconds)
  connection.run("PRAGMA busy_timeout = 5000;");
  // Enable WAL mode for better performance
  connection.run("PRAGMA journal_mode = WAL;");
  return connection;
}

// Initialize the database with required tables
function initializeDatabase() {
  const db = getConnection();
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER,
        directory TEXT,
        command TEXT
      );
    `);
  } finally {
    db.close();
  }
}

// Initialize database on startup
initializeDatabase();

// Functions for database operations
export function logCommand(timestamp: number, directory: string, command: string): void {
  const db = getConnection();
  try {
    const stmt = db.query('INSERT INTO commands (timestamp, directory, command) VALUES (?, ?, ?)');
    stmt.run(timestamp, directory, command);
  } finally {
    db.close();
  }
}

export function getTopCommands(limit = 10): { command: string; count: number }[] {
  const db = getConnection();
  try {
    const stmt = db.query(`
      SELECT command, COUNT(*) as count 
      FROM commands 
      GROUP BY command 
      ORDER BY count DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as { command: string; count: number }[];
  } finally {
    db.close();
  }
}

export function getCommandsByHour(): { hour: number; count: number }[] {
  const db = getConnection();
  try {
    const stmt = db.query(`
      SELECT strftime('%H', datetime(timestamp, 'unixepoch')) as hour, 
             COUNT(*) as count 
      FROM commands 
      GROUP BY hour 
      ORDER BY hour
    `);
    return stmt.all() as { hour: number; count: number }[];
  } finally {
    db.close();
  }
}

export function getAllCommands(): { id: number; timestamp: number; directory: string; command: string }[] {
  const db = getConnection();
  try {
    const stmt = db.query('SELECT * FROM commands ORDER BY timestamp DESC');
    return stmt.all() as { id: number; timestamp: number; directory: string; command: string }[];
  } finally {
    db.close();
  }
}

export function cleanOldCommands(olderThanTimestamp: number): number {
  const db = getConnection();
  try {
    const stmt = db.query('DELETE FROM commands WHERE timestamp < ?');
    const result = stmt.run(olderThanTimestamp);
    return result.changes;
  } finally {
    db.close();
  }
}

export function searchCommands(query: string): { id: number; timestamp: number; directory: string; command: string }[] {
  const db = getConnection();
  try {
    const stmt = db.query('SELECT * FROM commands WHERE command LIKE ? ORDER BY timestamp DESC');
    return stmt.all(`%${query}%`) as { id: number; timestamp: number; directory: string; command: string }[];
  } finally {
    db.close();
  }
} 