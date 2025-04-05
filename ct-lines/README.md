# count-lines

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
npm install -g count-lines
```

## Usage

```bash
count-lines <directory> [options]
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
count-lines .
```

Count lines in a specific directory, excluding test files:
```bash
count-lines src --exclude "**/*.test.*" --exclude "**/__tests__/**"
```

Count lines and save results in multiple formats:
```bash
count-lines . --output-dir results
```

Use a custom language configuration:
```bash
count-lines . --language-conf custom-languages.json
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

MIT 