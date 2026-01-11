import { getScripts } from './getScripts';
import { suggestScripts } from './suggestScripts';
import { runScript } from './runScript';
import type {
  ScriptInfo,
  EnquirerChoice,
  EnquirerAutoCompletePromptOptions,
  EnquirerAutoCompletePrompt,
} from './interfaces';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AutoComplete: AutoCompletePrompt } = require('enquirer');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  inverse: '\x1b[7m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  bgCyan: '\x1b[46m',
  black: '\x1b[30m',
  gray: '\x1b[90m',
};

// Nerd Font icons mapped to script categories (using Material Design Icons - md-*)
const scriptIcons: Record<string, { icon: string; color: keyof typeof colors }> = {
  // Build/Compile
  build: { icon: '󰏗', color: 'yellow' },    // md-package-variant
  compile: { icon: '󰏗', color: 'yellow' },
  bundle: { icon: '󰏗', color: 'yellow' },

  // Development/Run
  dev: { icon: '󰐊', color: 'green' },       // md-play
  start: { icon: '󰐊', color: 'green' },
  serve: { icon: '󰐊', color: 'green' },
  run: { icon: '󰐊', color: 'green' },

  // Watch
  watch: { icon: '󰈈', color: 'cyan' },      // md-eye
  preview: { icon: '󰈈', color: 'cyan' },

  // Test
  test: { icon: '󰙨', color: 'magenta' },    // md-test-tube
  spec: { icon: '󰙨', color: 'magenta' },
  e2e: { icon: '󰙨', color: 'magenta' },
  jest: { icon: '󰙨', color: 'magenta' },
  vitest: { icon: '󰙨', color: 'magenta' },
  coverage: { icon: '󰙨', color: 'magenta' },

  // Lint/Format
  lint: { icon: '󰃢', color: 'cyan' },       // md-broom
  eslint: { icon: '󰃢', color: 'cyan' },
  format: { icon: '󰉢', color: 'cyan' },     // md-format-align-left
  prettier: { icon: '󰉢', color: 'cyan' },
  check: { icon: '󰄬', color: 'cyan' },      // md-check

  // Type checking (TypeScript icon)
  typecheck: { icon: '󰛦', color: 'blue' },  // md-language-typescript
  types: { icon: '󰛦', color: 'blue' },
  tsc: { icon: '󰛦', color: 'blue' },

  // Clean
  clean: { icon: '󰩺', color: 'yellow' },    // md-trash-can
  reset: { icon: '󰩺', color: 'yellow' },

  // Install/Setup
  install: { icon: '󰇚', color: 'cyan' },    // md-download
  setup: { icon: '󰇚', color: 'cyan' },
  postinstall: { icon: '󰇚', color: 'cyan' },
  prepare: { icon: '󰇚', color: 'cyan' },

  // Deploy/Release
  deploy: { icon: '󰁜', color: 'magenta' },  // md-rocket (md-arrow-up-bold)
  release: { icon: '󰁜', color: 'magenta' },
  publish: { icon: '󰁜', color: 'magenta' },

  // Documentation
  docs: { icon: '󰈙', color: 'blue' },       // md-file-document
  doc: { icon: '󰈙', color: 'blue' },
  storybook: { icon: '󰈙', color: 'blue' },

  // Database
  db: { icon: '󰆼', color: 'yellow' },       // md-database
  migrate: { icon: '󰆼', color: 'yellow' },
  seed: { icon: '󰆼', color: 'yellow' },
  prisma: { icon: '󰆼', color: 'yellow' },
  drizzle: { icon: '󰆼', color: 'yellow' },

  // Generate/Scaffold
  generate: { icon: '󰒓', color: 'cyan' },   // md-cog
  gen: { icon: '󰒓', color: 'cyan' },
  scaffold: { icon: '󰒓', color: 'cyan' },
  codegen: { icon: '󰒓', color: 'cyan' },

  // Link
  link: { icon: '󰌷', color: 'blue' },       // md-link
  unlink: { icon: '󰌷', color: 'blue' },

  // Debug
  debug: { icon: '󰃤', color: 'yellow' },    // md-bug
};

// Default icon for unrecognized scripts
const defaultIcon = { icon: '󰆍', color: 'gray' as keyof typeof colors }; // md-console

function getScriptCategory(scriptName: string): { icon: string; color: keyof typeof colors } {
  const name = scriptName.toLowerCase();

  // Check for exact match first
  if (scriptIcons[name]) {
    return scriptIcons[name];
  }

  // Check if script name contains any of the keywords
  for (const [keyword, iconConfig] of Object.entries(scriptIcons)) {
    if (name.includes(keyword)) {
      return iconConfig;
    }
  }

  return defaultIcon;
}

function getIcon(scriptName: string): string {
  return getScriptCategory(scriptName).icon;
}

function getIconColor(scriptName: string): string {
  const category = getScriptCategory(scriptName);
  return colors[category.color];
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

// Get short package name (last folder segment)
function getShortPackageName(packageName: string): string {
  if (!packageName || packageName === '(root)') return 'root';
  const parts = packageName.split('/');
  return parts[parts.length - 1] || packageName;
}

interface RunnerOptions {
  multi?: boolean;
  workspaces?: boolean;
}

export async function interactiveScriptRunner(options: RunnerOptions = {}) {
  const scripts = await getScripts({ workspaces: options.workspaces });

  if (scripts.length === 0) {
    return;
  }

  const termWidth = getTerminalWidth();
  const isMonorepo = scripts.some((s) => s.packageName);

  // Calculate max lengths for alignment
  const maxNameLength = Math.max(...scripts.map((s) => s.name.length));

  // For monorepo, use short package names
  const shortPackageNames = isMonorepo
    ? scripts.map((s) => getShortPackageName(s.packageName || ''))
    : [];
  const maxShortPackageLength = isMonorepo
    ? Math.max(...shortPackageNames.map((n) => n.length))
    : 0;

  // Layout: icon (1) + space (1) + name + space (2) + [package] + space (2) + command
  // Cap package display to reasonable width
  const packageDisplayWidth = Math.min(maxShortPackageLength, 15);
  const packageColWidth = isMonorepo ? packageDisplayWidth + 3 : 0; // brackets + space
  const reservedSpace = 1 + 1 + maxNameLength + 2 + packageColWidth + 2 + 4;
  const maxCommandLength = Math.max(15, termWidth - reservedSpace);

  // Create a unique key for each script (handles duplicate script names in monorepo)
  const getScriptKey = (s: ScriptInfo) =>
    isMonorepo ? `${s.packageName}:${s.name}` : s.name;

  const choices: EnquirerChoice[] = scripts.map(
    (s: ScriptInfo) => {
      const icon = getIcon(s.name);
      const iconColor = getIconColor(s.name);
      const truncatedCommand = truncate(s.command, maxCommandLength);

      let message: string;
      if (isMonorepo && s.packageName) {
        const shortPkg = truncate(getShortPackageName(s.packageName), packageDisplayWidth);
        const packageTag = `${colors.dim}[${shortPkg}]${colors.reset}`;
        const paddedPackageTag = packageTag + ' '.repeat(packageDisplayWidth - shortPkg.length);
        message = `${iconColor}${icon}${colors.reset} ${s.name.padEnd(maxNameLength)}  ${paddedPackageTag}  ${colors.dim}${truncatedCommand}${colors.reset}`;
      } else {
        message = `${iconColor}${icon}${colors.reset} ${s.name.padEnd(maxNameLength)}  ${colors.dim}${truncatedCommand}${colors.reset}`;
      }

      return {
        name: getScriptKey(s),
        value: getScriptKey(s),
        message,
        command: s.command,
        packageName: s.packageName,
        packagePath: s.packagePath,
      };
    }
  );

  const promptOptions: EnquirerAutoCompletePromptOptions = {
    name: 'selectedScript',
    message: isMonorepo
      ? `${colors.cyan}Select script${colors.reset} ${colors.dim}(workspaces)${colors.reset}`
      : `${colors.cyan}Select script${colors.reset}`,
    limit: 15,
    multiple: options.multi || false,
    choices: choices,
    pointer: `${colors.cyan}❯${colors.reset}`,
    suggest(input: string, choices: EnquirerChoice[]) {
      return suggestScripts(choices, input);
    },
    result(names: string | string[]) {
      // enquirer passes the selected 'name' values which already match our script keys
      return Array.isArray(names) ? names : [names];
    },
  };

  // Create prompt and override renderChoice for better highlighting
  const prompt = new AutoCompletePrompt(
    promptOptions
  ) as EnquirerAutoCompletePrompt;

  // Override the highlight method for focused items
  const originalRenderChoice = (
    prompt as unknown as {
      renderChoice: (choice: EnquirerChoice, i: number) => string;
    }
  ).renderChoice;
  (
    prompt as unknown as {
      renderChoice: (choice: EnquirerChoice, i: number) => string;
    }
  ).renderChoice = function (choice: EnquirerChoice, i: number) {
    const self = this as unknown as { index: number; input: string };
    const isFocused = i === self.index;

    if (isFocused) {
      // Find the original script to recreate the message with highlight
      const script = scripts.find((s) => getScriptKey(s) === choice.value);
      if (script) {
        const icon = getIcon(script.name);
        const truncatedCommand = truncate(script.command, maxCommandLength);

        if (isMonorepo && script.packageName) {
          const shortPkg = truncate(getShortPackageName(script.packageName), packageDisplayWidth);
          const packageTag = `${colors.cyan}[${shortPkg}]${colors.reset}`;
          const paddedPackageTag = packageTag + ' '.repeat(packageDisplayWidth - shortPkg.length);
          return `${colors.cyan}❯${colors.reset} ${colors.cyan}${icon}${colors.reset} ${colors.cyan}${colors.bold}${script.name.padEnd(maxNameLength)}${colors.reset}  ${paddedPackageTag}  ${colors.dim}${truncatedCommand}${colors.reset}`;
        } else {
          return `${colors.cyan}❯${colors.reset} ${colors.cyan}${icon}${colors.reset} ${colors.cyan}${colors.bold}${script.name.padEnd(maxNameLength)}${colors.reset}  ${colors.dim}${truncatedCommand}${colors.reset}`;
        }
      }
    }

    return originalRenderChoice.call(this, choice, i);
  };

  try {
    const result = await prompt.run();
    const selectedScriptKeys = Array.isArray(result) ? result : [result];

    if (!selectedScriptKeys || selectedScriptKeys.length === 0) {
      console.log('No script selected.');
      return;
    }

    console.log('');

    for (const scriptKey of selectedScriptKeys) {
      const choice = choices.find((c) => c.value === scriptKey);
      const script = scripts.find((s) => getScriptKey(s) === scriptKey);

      if (!script) continue;

      if (selectedScriptKeys.length > 1 || isMonorepo) {
        const location = script.packageName
          ? ` ${colors.dim}(${script.packageName})${colors.reset}`
          : '';
        console.log(
          `\n${colors.green}▶${colors.reset} Running: ${colors.bold}${script.name}${colors.reset}${location}\n`
        );
      }

      await runScript(script.name, script.packagePath);
    }
  } catch (error) {
    // User cancelled (Ctrl+C)
    if ((error as Error).message?.includes('cancelled')) {
      return;
    }
    console.error('Error:', error);
  }
}
