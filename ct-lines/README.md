# ct-lines

A command-line tool for counting lines of code, comments, and blank lines in files within a directory. This tool is based on the `vscode-counter` VS Code extension and provides similar functionality in a CLI environment.

## Features

- Counts lines of code, comments, and blank lines in files
- Supports multiple programming languages out of the box
- Customizable language definitions
- Respects `.gitignore` files
- Multiple output formats (text, JSON, CSV)
- Progress bar for long-running operations
- Configurable file inclusion/exclusion patterns
- Detailed statistics by language and directory

## Installation

```bash
npm install -g ct-lines
```

## Usage

```bash
ct-lines <directory> [options]
```

### Options

- `-i, --include <pattern>`: Glob patterns for files to include (can be specified multiple times). Default: `['**/*']`
- `-e, --exclude <pattern>`: Glob patterns for files/directories to exclude (can be specified multiple times)
- `--use-gitignore`: Use `.gitignore` files found in the target directory to exclude files. Default: `true`
- `--language-conf <path>`: Path to a custom JSON file defining or overriding language configurations
- `-f, --output-format <format>`: Format for the summary output. Options: `text`, `json`, `csv`. Default: `text`
- `-o, --output-dir <path>`: Directory to save detailed results files (results.json, results.txt, etc.)
- `--encoding <encoding>`: File encoding to use when reading files. Default: `utf8`
- `--ignore-unsupported`: Ignore files for which no language definition is found. Default: `true`
- `--include-incomplete-line`: Count the last line even if it doesn't end with a newline. Default: `false`
- `--print-commas`: Print numbers with commas. Default: `true`

### Examples

Count lines in the current directory:
```bash
ct-lines .
```

Count lines in a specific directory, excluding test files:
```bash
ct-lines src --exclude "**/*.test.*" --exclude "**/__tests__/**"
```

Count lines and save results in multiple formats:
```bash
ct-lines . --output-dir results
```

Use a custom language configuration:
```bash
ct-lines . --language-conf custom-languages.json
```

## Language Configuration

The tool comes with built-in language definitions for common programming languages. You can override or extend these definitions by providing a custom JSON file with the `--language-conf` option.

Example language configuration:
```json
{
  "typescript": {
    "aliases": ["ts"],
    "extensions": [".ts", ".tsx"],
    "lineComments": ["//"],
    "blockComments": [["/*", "*/"]],
    "blockStrings": [["`", "`"]],
    "lineStrings": ["'", "\""]
  }
}
```

## Output Formats

### Text Format
The default text format provides a human-readable table with statistics organized by language, directory, and individual files.

### JSON Format
The JSON format provides a structured representation of the results, including:
- Total statistics
- Statistics by language
- Statistics by directory
- Individual file statistics

### CSV Format
The CSV format provides a tabular representation of the results, with one row per file and columns for:
- Filename
- Language
- Code lines per language
- Comment lines
- Blank lines
- Total lines

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License, Version 2.0.

See the [LICENSE](LICENSE) file for the full license text.

## Versioning and Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) to automate version management and package publishing. The release process is triggered on every push to the `main` branch and follows the Angular Commit Message Convention.

### How It Works

1. Analyzes commit messages since the last release
2. Determines the next version number based on the types of changes
3. Generates/updates the CHANGELOG.md
4. Creates a new GitHub release with release notes
5. Updates package.json with the new version
6. Publishes to npm (if configured)

### Commit Message Convention

We follow the [Angular Commit Message Convention](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#-commit-message-format). Example:

```
feat(cli): add new option for output format
fix(core): handle empty files gracefully
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