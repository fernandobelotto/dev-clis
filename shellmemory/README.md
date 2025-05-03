# shellmemory

A terminal command logger that records every command across your shell sessions directly into a SQLite database.

## Features

- Records every command you run in your terminal
- Stores data in SQLite database (no text files)
- Uses Bun's high-performance native SQLite integration
- Provides command-line utilities for statistics, export, and cleanup
- Easy ZSH integration

## Installation

1. Clone this repository:
```bash
git clone https://github.com/fernandobelotto/shellmemory.git
cd shellmemory
```

2. Install dependencies:
```bash
bun install
```

3. Install the CLI globally:
```bash
bun run install-cli
```

4. Add the ZSH hook to your `.zshrc` file:
```bash
# Add this to your .zshrc file
function log_command() {
  echo "$(date +%s)|$PWD|$1" | shellmemory log >/dev/null 2>&1
}
autoload -U add-zsh-hook
add-zsh-hook preexec log_command
```

5. Restart your shell or source your `.zshrc`:
```bash
source ~/.zshrc
```

## Usage

### Viewing Command Statistics

To see statistics about your most used commands and hourly usage:

```bash
shellmemory stats
```

### Exporting Command History

Export your command history in JSON or CSV format:

```bash
# Export as JSON (default)
shellmemory export

# Export as CSV
shellmemory export --format=csv

# Export to a file
shellmemory export --format=json --output=commands.json
```

### Cleaning Old Commands

Remove old command entries:

```bash
# Delete commands older than 30 days (default)
shellmemory clean

# Delete commands older than 7 days
shellmemory clean --older-than=7d

# Delete commands older than 12 hours
shellmemory clean --older-than=12h
```

## Technical Details

- Uses Bun's built-in SQLite module (`bun:sqlite`)
- Enables WAL mode for better performance
- Data stored in `~/.shellmemory/commands.db`

## License

[Apache License 2.0](LICENSE) 