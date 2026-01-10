# script-scan

> A fast, interactive CLI for discovering and running npm scripts with fuzzy search

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-f9f1e1?logo=bun)](https://bun.sh)

Stop scrolling through `package.json` to find the script you need. **script-scan** gives you an interactive, searchable prompt that shows all available scripts at a glance.

```
❯ script-scan

? Select script
❯ ● build                  bun build ./src/cli/index.ts --outdir ./dist
  ◆ dev                    bun --watch src/cli/index.ts
  ■ start                  bun dist/index.js
  ▸ typecheck              tsc --noEmit
  ★ link                   bun link
```

## Features

- **Fuzzy search** - Type to filter scripts instantly. Search matches script names *and* commands
- **Multi-term search** - Space-separated terms use AND logic (`build prod` matches scripts containing both)
- **Monorepo support** - Scan all workspace packages with `-w` flag
- **Multi-select** - Run multiple scripts sequentially with `-m` flag
- **Smart discovery** - Automatically finds `package.json` by walking up the directory tree
- **Clean UI** - Color-coded output with command previews that adapt to terminal width

## Installation

### Using Bun (recommended)

```bash
bun install -g script-scan
```

### From source

```bash
git clone https://github.com/fernandobelotto/script-scan.git
cd script-scan
bun install
bun run build
bun link
```

## Usage

### Basic usage

Run in any directory with a `package.json`:

```bash
script-scan
```

Start typing to filter scripts. Press Enter to run the selected script.

### Options

```
-m, --multi        Select and run multiple scripts
-w, --workspaces   Scan all packages in a monorepo
-V, --version      Show version number
-h, --help         Show help
```

### Examples

**Run a single script interactively:**
```bash
script-scan
```

**Select multiple scripts to run sequentially:**
```bash
script-scan -m
```

**Scan all workspace packages in a monorepo:**
```bash
script-scan -w
```

## Monorepo Support

When using the `-w` flag, script-scan will:

1. Find the monorepo root by detecting `workspaces` in `package.json` or `pnpm-workspace.yaml`
2. Recursively scan all packages for scripts
3. Display scripts with their package name in brackets

```
? Select script (workspaces)
❯ ● build          [api]     tsc && node dist/index.js
  ◆ build          [web]     next build
  ■ dev            [api]     ts-node-dev src/index.ts
  ▸ dev            [web]     next dev
  ★ test           [shared]  vitest
```

Scripts run from their respective package directories, so relative paths and dependencies work correctly.

## How It Works

1. **Discovery** - Walks up from the current directory to find the nearest `package.json`
2. **Parsing** - Extracts all scripts and their commands
3. **Presentation** - Displays an interactive autocomplete prompt using [Enquirer](https://github.com/enquirer/enquirer)
4. **Execution** - Runs the selected script via `bun run` as a child process

## Tech Stack

- [Bun](https://bun.sh) - JavaScript runtime and build tool
- [Commander](https://github.com/tj/commander.js) - CLI argument parsing
- [Enquirer](https://github.com/enquirer/enquirer) - Interactive prompts

## Development

```bash
# Install dependencies
bun install

# Run in development mode (with watch)
bun run dev

# Build for production
bun run build

# Type check
bun run typecheck

# Build standalone executable
bun run build:executable
```

## Pro Tips

- **Create an alias** for quick access:
  ```bash
  alias n="script-scan"
  ```

- **Use in any subdirectory** - script-scan finds the nearest `package.json` automatically

- **Combine flags** for powerful workflows:
  ```bash
  script-scan -wm  # Multi-select across all workspace packages
  ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT - see [LICENSE](LICENSE) for details.

---

Made by [Fernando Bosco](https://github.com/fernandobelotto)
