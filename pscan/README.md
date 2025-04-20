# my-cli

## Features

- List of features here

## Installation

```bash
npm install -g my-cli
```

## Usage

```bash
my-cli [options]
```

### Options


### Examples

This is a example:
```bash
my-cli
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