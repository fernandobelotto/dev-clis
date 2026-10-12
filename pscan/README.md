# pscan

A CLI tool to interactively scan and kill processes by port number on macOS/Linux. Perfect for developers who need to quickly find and kill processes occupying specific ports.

## Features

- 🔍 Interactive port scanning with real-time filtering
- 🎯 Multi-select support to kill multiple processes at once
- 🚀 Fast and efficient using native system commands
- 💻 Works on macOS and Linux
- ⌨️ User-friendly interface with keyboard navigation
- 🔎 Search by port number or process name

## Installation

```bash
# Using npm
npm install -g pscan

# Using bun
bun install -g pscan
```

## Usage

Simply run:
```bash
pscan
```

This will:
1. Scan for all TCP ports in LISTEN state
2. Show an interactive interface where you can:
   - Type to filter ports/processes
   - Use arrow keys to navigate
   - Space to select/unselect processes
   - Enter to confirm selection
3. Kill all selected processes

### Examples

Kill a specific port (e.g., development server on 5173):
```bash
# Launch pscan and type "5173" to filter
pscan
```

Kill multiple Node.js processes:
```bash
# Launch pscan and type "node" to filter
pscan
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License, Version 2.0.

See the [LICENSE](LICENSE) file for the full license text.

## Versioning and Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) to automate version management and package publishing. The release process is triggered on every push to the `main` branch and follows the Angular Commit Message Convention.

### Commit Message Convention

We follow the [Angular Commit Message Convention](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#-commit-message-format). Example:

```
feat(scan): add IPv6 support for port scanning
fix(kill): handle process termination errors gracefully
```

Breaking changes should include `BREAKING CHANGE:` in the commit body or a `!` after the type/scope.

### Manual Release

To trigger a release manually:

1. Ensure you're on the main branch
2. Run:
```bash
npx semantic-release
```

See `.releaserc.json` for configuration details. 