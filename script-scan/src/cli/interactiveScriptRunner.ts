import { getScripts } from './getScripts';
import { suggestScripts } from './suggestScripts';
import { runScript } from './runScript';
import { detectPackageManager } from './detectPackageManager';
import type {
  ScriptInfo,
  EnquirerChoice,
  EnquirerAutoCompletePromptOptions,
  EnquirerAutoCompletePrompt,
} from './interfaces';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AutoComplete: AutoCompletePrompt, Confirm } = require('enquirer');

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

// Icon configuration type
interface IconConfig {
  icon: string;
  color: keyof typeof colors;
}

// Nerd Font icons mapped to script categories (using Material Design Icons - md-*)
const scriptIcons: Record<string, IconConfig> = {
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

// Pre-computed sorted keywords for partial matching (longest first for better matches)
const sortedKeywords = Object.keys(scriptIcons).sort((a, b) => b.length - a.length);

// Default icon for unrecognized scripts
const defaultIcon: IconConfig = { icon: '󰆍', color: 'gray' }; // md-console

function getScriptCategory(scriptName: string): IconConfig {
  const name = scriptName.toLowerCase();

  // Check for exact match first (O(1))
  if (scriptIcons[name]) {
    return scriptIcons[name];
  }

  // Check partial matches using pre-sorted keywords (longest first)
  for (const keyword of sortedKeywords) {
    if (name.includes(keyword)) {
      return scriptIcons[keyword]!;
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
  workspaces?: boolean;
  limit?: number;
}

async function confirmMultiSelect(
  scripts: ScriptInfo[],
  selectedKeys: string[],
  getScriptKey: (s: ScriptInfo) => string
): Promise<boolean> {
  console.log('');
  console.log(`${colors.cyan}${colors.bold}Selected scripts (in order):${colors.reset}`);

  let orderNum = 1;
  for (const key of selectedKeys) {
    const script = scripts.find((s) => getScriptKey(s) === key);
    if (script) {
      const location = script.packageName
        ? ` ${colors.dim}(${script.packageName})${colors.reset}`
        : '';
      console.log(`  ${colors.yellow}${orderNum}.${colors.reset} ${script.name}${location}`);
      orderNum++;
    }
  }

  console.log('');

  const pm = detectPackageManager(process.cwd());
  const prompt = new Confirm({
    name: 'confirm',
    message: `Run ${selectedKeys.length} scripts with ${colors.cyan}${pm}${colors.reset}?`,
    initial: true,
  });

  try {
    return await prompt.run();
  } catch {
    return false;
  }
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

  // Track selection order
  const selectionOrder: string[] = [];

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
      ? `${colors.cyan}Select script${colors.reset} ${colors.dim}(space to select, enter to run)${colors.reset}`
      : `${colors.cyan}Select script${colors.reset} ${colors.dim}(space to select, enter to run)${colors.reset}`,
    limit: options.limit || 15,
    multiple: true,
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

  // Override toggle to track selection order
  const promptInternal = prompt as unknown as {
    index: number;
    choices: Array<{ name: string; enabled?: boolean }>;
    toggle: (choice: { name: string; enabled?: boolean }) => void;
    renderChoice: (choice: EnquirerChoice, i: number) => string;
  };

  const originalToggle = promptInternal.toggle.bind(prompt);
  promptInternal.toggle = function(choice: { name: string; enabled?: boolean }) {
    const wasEnabled = choice.enabled;
    originalToggle(choice);

    if (!wasEnabled) {
      // Was not selected, now selected - add to order
      if (!selectionOrder.includes(choice.name)) {
        selectionOrder.push(choice.name);
      }
    } else {
      // Was selected, now deselected - remove from order
      const idx = selectionOrder.indexOf(choice.name);
      if (idx !== -1) {
        selectionOrder.splice(idx, 1);
      }
    }
  };

  // Override the highlight method for focused items
  const originalRenderChoice = promptInternal.renderChoice;
  promptInternal.renderChoice = function (choice: EnquirerChoice, i: number) {
    const self = this as unknown as { index: number; input: string; choices: Array<{ enabled?: boolean }> };
    const isFocused = i === self.index;
    const isSelected = self.choices[i]?.enabled;

    // Find selection order number
    const orderIdx = selectionOrder.indexOf(choice.value);
    const orderPrefix = orderIdx !== -1
      ? `${colors.yellow}${orderIdx + 1}${colors.reset} `
      : '  ';

    if (isFocused) {
      // Find the original script to recreate the message with highlight
      const script = scripts.find((s) => getScriptKey(s) === choice.value);
      if (script) {
        const icon = getIcon(script.name);
        const truncatedCommand = truncate(script.command, maxCommandLength);
        const checkMark = isSelected ? `${colors.green}◉${colors.reset} ` : `${colors.dim}○${colors.reset} `;

        if (isMonorepo && script.packageName) {
          const shortPkg = truncate(getShortPackageName(script.packageName), packageDisplayWidth);
          const packageTag = `${colors.cyan}[${shortPkg}]${colors.reset}`;
          const paddedPackageTag = packageTag + ' '.repeat(packageDisplayWidth - shortPkg.length);
          return `${colors.cyan}❯${colors.reset} ${checkMark}${orderPrefix}${colors.cyan}${icon}${colors.reset} ${colors.cyan}${colors.bold}${script.name.padEnd(maxNameLength)}${colors.reset}  ${paddedPackageTag}  ${colors.dim}${truncatedCommand}${colors.reset}`;
        } else {
          return `${colors.cyan}❯${colors.reset} ${checkMark}${orderPrefix}${colors.cyan}${icon}${colors.reset} ${colors.cyan}${colors.bold}${script.name.padEnd(maxNameLength)}${colors.reset}  ${colors.dim}${truncatedCommand}${colors.reset}`;
        }
      }
    }

    // Non-focused items
    const script = scripts.find((s) => getScriptKey(s) === choice.value);
    if (script) {
      const icon = getIcon(script.name);
      const iconColor = getIconColor(script.name);
      const truncatedCommand = truncate(script.command, maxCommandLength);
      const checkMark = isSelected ? `${colors.green}◉${colors.reset} ` : `${colors.dim}○${colors.reset} `;

      if (isMonorepo && script.packageName) {
        const shortPkg = truncate(getShortPackageName(script.packageName), packageDisplayWidth);
        const packageTag = `${colors.dim}[${shortPkg}]${colors.reset}`;
        const paddedPackageTag = packageTag + ' '.repeat(packageDisplayWidth - shortPkg.length);
        return `  ${checkMark}${orderPrefix}${iconColor}${icon}${colors.reset} ${script.name.padEnd(maxNameLength)}  ${paddedPackageTag}  ${colors.dim}${truncatedCommand}${colors.reset}`;
      } else {
        return `  ${checkMark}${orderPrefix}${iconColor}${icon}${colors.reset} ${script.name.padEnd(maxNameLength)}  ${colors.dim}${truncatedCommand}${colors.reset}`;
      }
    }

    return originalRenderChoice.call(this, choice, i);
  };

  try {
    await prompt.run();

    // Determine which scripts to run
    let selectedScriptKeys: string[];

    if (selectionOrder.length > 0) {
      // Use selection order (user explicitly selected with space)
      selectedScriptKeys = selectionOrder;
    } else {
      // No explicit selection, use the focused item (user just pressed enter)
      const focusedIndex = promptInternal.index;
      const focusedChoice = promptInternal.choices[focusedIndex];
      if (focusedChoice) {
        selectedScriptKeys = [focusedChoice.name];
      } else {
        console.log('No script selected.');
        return;
      }
    }

    // Confirm before running multiple scripts
    if (selectedScriptKeys.length > 1) {
      const confirmed = await confirmMultiSelect(
        scripts,
        selectedScriptKeys,
        getScriptKey
      );
      if (!confirmed) {
        console.log(`${colors.dim}Cancelled.${colors.reset}`);
        return;
      }
    } else {
      console.log('');
    }

    for (const scriptKey of selectedScriptKeys) {
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
