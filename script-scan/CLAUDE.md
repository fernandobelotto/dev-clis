# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

script-scan is an interactive CLI tool for running npm/bun scripts. It reads package.json scripts and presents them in an autocomplete-searchable prompt using enquirer.

## Commands

```bash
# Install dependencies
bun install

# Development (watch mode)
bun run dev

# Build
bun run build

# Type checking
bun run typecheck

# Run built CLI
bun run start

# Build standalone executable
bun run build:executable

# Link CLI globally for testing
bun run link
```

## Testing Changes

After making code changes, always rebuild and relink to test:

```bash
bun run build && bun run link
```

Then test the CLI from any directory using `script-scan` (or the user's alias like `n`).

## Architecture

The CLI is built with Bun and uses Commander for argument parsing and Enquirer for the interactive prompt.

**Entry point flow:**
- `src/cli/index.ts` - CLI entry point, defines commands/options with Commander
- `src/cli/interactiveScriptRunner.ts` - Main orchestrator that coordinates the interactive experience

**Core modules:**
- `getScripts.ts` - Walks up directory tree to find package.json, extracts scripts
- `suggestScripts.ts` - Fuzzy filtering logic for autocomplete (AND-based multi-term matching)
- `runScript.ts` - Spawns `bun run <script>` as child process

**Type definitions:**
- `interfaces.ts` - TypeScript interfaces for ScriptInfo and Enquirer types
- `types.d.ts` - Module declaration for enquirer's AutoComplete

## Key Implementation Details

- Scripts are run via `bun run` (not npm)
- The `-m/--multi` flag enables selecting multiple scripts
- The `-w/--workspaces` flag enables monorepo mode (scans all package.json files)
- Terminal width detection is used to truncate long command previews
- ANSI colors and icons are used for visual styling in the prompt

## Monorepo Support

When using `-w` flag, the tool:
- Finds the monorepo root by looking for `workspaces` in package.json or `pnpm-workspace.yaml`
- Recursively scans for all package.json files (excluding node_modules, .git, .github, dist, build, etc.)
- Displays scripts with short package names in brackets like `[mastra]`
- Runs scripts from their respective package directories
