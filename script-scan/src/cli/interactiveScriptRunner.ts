import { detectPackageManager } from "./detectPackageManager";
import { getMakefileTargets } from "./getMakefileTargets";
import { getScripts } from "./getScripts";
import type {
  ScriptInfo,
  ScriptSource,
  EnquirerChoice,
  EnquirerAutoCompletePromptOptions,
  EnquirerAutoCompletePrompt,
} from "./interfaces";
import { runScript } from "./runScript";
import { suggestScripts } from "./suggestScripts";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AutoComplete: AutoCompletePrompt, Confirm } = require("enquirer");

// ANSI color codes
const colors = {
  bgCyan: "\x1B[46m",
  black: "\u001b[30m",
  blue: "\x1B[34m",
  bold: "\x1B[1m",
  cyan: "\x1B[36m",
  dim: "\x1B[2m",
  gray: "\x1B[90m",
  green: "\x1B[32m",
  inverse: "\x1B[7m",
  magenta: "\x1B[35m",
  reset: "\x1B[0m",
  white: "\x1B[37m",
  yellow: "\x1B[33m",
};

// Icon configuration type
interface IconConfig {
  icon: string;
  color: keyof typeof colors;
}

// Nerd Font icons mapped to script categories (using Material Design Icons - md-*)
const scriptIcons: Record<string, IconConfig> = {
  // Build/Compile
  build: { color: "yellow", icon: "󰏗" }, // md-package-variant
  compile: { color: "yellow", icon: "󰏗" },
  bundle: { color: "yellow", icon: "󰏗" },

  // Development/Run
  dev: { color: "green", icon: "󰐊" }, // md-play
  start: { color: "green", icon: "󰐊" },
  serve: { color: "green", icon: "󰐊" },
  run: { color: "green", icon: "󰐊" },

  // Watch
  watch: { color: "cyan", icon: "󰈈" }, // md-eye
  preview: { color: "cyan", icon: "󰈈" },

  // Test
  test: { color: "magenta", icon: "󰙨" }, // md-test-tube
  spec: { color: "magenta", icon: "󰙨" },
  e2e: { color: "magenta", icon: "󰙨" },
  jest: { color: "magenta", icon: "󰙨" },
  vitest: { color: "magenta", icon: "󰙨" },
  coverage: { color: "magenta", icon: "󰙨" },

  // Lint/Format
  lint: { color: "cyan", icon: "󰃢" }, // md-broom
  eslint: { color: "cyan", icon: "󰃢" },
  format: { color: "cyan", icon: "󰉢" }, // md-format-align-left
  prettier: { color: "cyan", icon: "󰉢" },
  check: { color: "cyan", icon: "󰄬" }, // md-check

  // Type checking (TypeScript icon)
  typecheck: { color: "blue", icon: "󰛦" }, // md-language-typescript
  types: { color: "blue", icon: "󰛦" },
  tsc: { color: "blue", icon: "󰛦" },

  // Clean
  clean: { color: "yellow", icon: "󰩺" }, // md-trash-can
  reset: { color: "yellow", icon: "󰩺" },

  // Install/Setup
  install: { color: "cyan", icon: "󰇚" }, // md-download
  setup: { color: "cyan", icon: "󰇚" },
  postinstall: { color: "cyan", icon: "󰇚" },
  prepare: { color: "cyan", icon: "󰇚" },

  // Deploy/Release
  deploy: { color: "magenta", icon: "󰁜" }, // md-rocket (md-arrow-up-bold)
  release: { color: "magenta", icon: "󰁜" },
  publish: { color: "magenta", icon: "󰁜" },

  // Documentation
  docs: { color: "blue", icon: "󰈙" }, // md-file-document
  doc: { color: "blue", icon: "󰈙" },
  storybook: { color: "blue", icon: "󰈙" },

  // Database
  db: { color: "yellow", icon: "󰆼" }, // md-database
  migrate: { color: "yellow", icon: "󰆼" },
  seed: { color: "yellow", icon: "󰆼" },
  prisma: { color: "yellow", icon: "󰆼" },
  drizzle: { color: "yellow", icon: "󰆼" },

  // Generate/Scaffold
  generate: { color: "cyan", icon: "󰒓" }, // md-cog
  gen: { color: "cyan", icon: "󰒓" },
  scaffold: { color: "cyan", icon: "󰒓" },
  codegen: { color: "cyan", icon: "󰒓" },

  // Link
  link: { color: "blue", icon: "󰌷" }, // md-link
  unlink: { color: "blue", icon: "󰌷" },

  // Debug
  debug: { color: "yellow", icon: "󰃤" }, // md-bug
};

// Pre-computed sorted keywords for partial matching (longest first for better matches)
const sortedKeywords = Object.keys(scriptIcons).sort(
  (a, b) => b.length - a.length
);

// Default icon for unrecognized scripts
const defaultIcon: IconConfig = { color: "gray", icon: "󰆍" }; // md-console

// Default icon for Makefile targets
const makeIcon: IconConfig = { color: "yellow", icon: "󱁤" }; // md-hammer-wrench

function getScriptCategory(
  scriptName: string,
  source: ScriptSource = "npm"
): IconConfig {
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

  // Use make-specific default for Makefile targets
  return source === "make" ? makeIcon : defaultIcon;
}

function getIcon(scriptName: string, source: ScriptSource = "npm"): string {
  return getScriptCategory(scriptName, source).icon;
}

function getIconColor(
  scriptName: string,
  source: ScriptSource = "npm"
): string {
  const category = getScriptCategory(scriptName, source);
  return colors[category.color];
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength - 1)}…`;
}

function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

// Get short package name (last folder segment)
function getShortPackageName(packageName: string): string {
  if (!packageName || packageName === "(root)") {
    return "root";
  }
  const parts = packageName.split("/");
  return parts.at(-1) || packageName;
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
  console.log("");
  console.log(
    `${colors.cyan}${colors.bold}Selected scripts (in order):${colors.reset}`
  );

  let orderNum = 1;
  for (const key of selectedKeys) {
    const script = scripts.find((s) => getScriptKey(s) === key);
    if (script) {
      const location = script.packageName
        ? ` ${colors.dim}(${script.packageName})${colors.reset}`
        : "";
      console.log(
        `  ${colors.yellow}${orderNum}.${colors.reset} ${script.name}${location}`
      );
      orderNum++;
    }
  }

  console.log("");

  const pm = detectPackageManager(process.cwd());
  const prompt = new Confirm({
    initial: true,
    message: `Run ${selectedKeys.length} scripts with ${colors.cyan}${pm}${colors.reset}?`,
    name: "confirm",
  });

  try {
    return await prompt.run();
  } catch {
    return false;
  }
}

export async function interactiveScriptRunner(options: RunnerOptions = {}) {
  // Fetch npm scripts and makefile targets in parallel
  const [npmScripts, makeTargets] = await Promise.all([
    getScripts({ workspaces: options.workspaces }),
    getMakefileTargets({ workspaces: options.workspaces }),
  ]);

  const scripts = [...npmScripts, ...makeTargets];
  const hasBothSources = npmScripts.length > 0 && makeTargets.length > 0;

  if (scripts.length === 0) {
    console.error("No package.json scripts or Makefile targets found.");
    return;
  }

  const termWidth = getTerminalWidth();
  const isMonorepo = scripts.some((s) => s.packageName);

  // Calculate max lengths for alignment
  const maxNameLength = Math.max(...scripts.map((s) => s.name.length));

  // For monorepo, use short package names
  const shortPackageNames = isMonorepo
    ? scripts.map((s) => getShortPackageName(s.packageName || ""))
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

  // Create a unique key for each script (includes source to avoid conflicts)
  const getScriptKey = (s: ScriptInfo) => {
    const base = isMonorepo ? `${s.packageName}:${s.name}` : s.name;
    return hasBothSources ? `${s.source}:${base}` : base;
  };

  // Track selection order
  const selectionOrder: string[] = [];

  const choices: EnquirerChoice[] = scripts.map((s: ScriptInfo) => {
    const icon = getIcon(s.name, s.source);
    const iconColor = getIconColor(s.name, s.source);
    const truncatedCommand = truncate(s.command, maxCommandLength);

    // Source indicator when both npm and make are present
    const sourceTag = hasBothSources
      ? `${s.source === "npm" ? colors.green : colors.yellow}[${s.source}]${colors.reset} `
      : "";

    let message: string;
    if (isMonorepo && s.packageName) {
      const shortPkg = truncate(
        getShortPackageName(s.packageName),
        packageDisplayWidth
      );
      const packageTag = `${colors.dim}[${shortPkg}]${colors.reset}`;
      const paddedPackageTag =
        packageTag + " ".repeat(packageDisplayWidth - shortPkg.length);
      message = `${sourceTag}${iconColor}${icon}${colors.reset} ${s.name.padEnd(maxNameLength)}  ${paddedPackageTag}  ${colors.dim}${truncatedCommand}${colors.reset}`;
    } else {
      message = `${sourceTag}${iconColor}${icon}${colors.reset} ${s.name.padEnd(maxNameLength)}  ${colors.dim}${truncatedCommand}${colors.reset}`;
    }

    return {
      command: s.command,
      message,
      name: getScriptKey(s),
      packageName: s.packageName,
      packagePath: s.packagePath,
      source: s.source,
      value: getScriptKey(s),
    };
  });

  const promptOptions: EnquirerAutoCompletePromptOptions = {
    choices,
    limit: options.limit || 15,
    message: isMonorepo
      ? `${colors.cyan}Select script${colors.reset} ${colors.dim}(space to select, enter to run)${colors.reset}`
      : `${colors.cyan}Select script${colors.reset} ${colors.dim}(space to select, enter to run)${colors.reset}`,
    multiple: true,
    name: "selectedScript",
    pointer: `${colors.cyan}❯${colors.reset}`,
    result(names: string | string[]) {
      // enquirer passes the selected 'name' values which already match our script keys
      return Array.isArray(names) ? names : [names];
    },
    suggest(input: string, choices: EnquirerChoice[]) {
      return suggestScripts(choices, input);
    },
  };

  // Create prompt and override renderChoice for better highlighting
  const prompt = new AutoCompletePrompt(
    promptOptions
  ) as EnquirerAutoCompletePrompt;

  // Override toggle to track selection order
  const promptInternal = prompt as unknown as {
    index: number;
    choices: { name: string; enabled?: boolean }[];
    toggle: (choice: { name: string; enabled?: boolean }) => void;
    renderChoice: (choice: EnquirerChoice, i: number) => string;
  };

  const originalToggle = promptInternal.toggle.bind(prompt);
  promptInternal.toggle = function toggle(choice: {
    name: string;
    enabled?: boolean;
  }) {
    const wasEnabled = choice.enabled;
    originalToggle(choice);

    if (wasEnabled) {
      // Was selected, now deselected - remove from order
      const idx = selectionOrder.indexOf(choice.name);
      if (idx !== -1) {
        selectionOrder.splice(idx, 1);
      }
    } else {
      // Was not selected, now selected - add to order
      if (!selectionOrder.includes(choice.name)) {
        selectionOrder.push(choice.name);
      }
    }
  };

  // Override the highlight method for focused items
  const originalRenderChoice = promptInternal.renderChoice;
  promptInternal.renderChoice = function renderChoice(
    choice: EnquirerChoice,
    i: number
  ) {
    const self = this as unknown as {
      index: number;
      input: string;
      choices: { enabled?: boolean }[];
    };
    const isFocused = i === self.index;
    const isSelected = self.choices[i]?.enabled;

    // Find selection order number
    const orderIdx = selectionOrder.indexOf(choice.value);
    const orderPrefix =
      orderIdx === -1
        ? "  "
        : `${colors.yellow}${orderIdx + 1}${colors.reset} `;

    if (isFocused) {
      // Find the original script to recreate the message with highlight
      const script = scripts.find((s) => getScriptKey(s) === choice.value);
      if (script) {
        const icon = getIcon(script.name, script.source);
        const truncatedCommand = truncate(script.command, maxCommandLength);
        const checkMark = isSelected
          ? `${colors.green}◉${colors.reset} `
          : `${colors.dim}○${colors.reset} `;
        const sourceTag = hasBothSources
          ? `${script.source === "npm" ? colors.green : colors.yellow}[${script.source}]${colors.reset} `
          : "";

        if (isMonorepo && script.packageName) {
          const shortPkg = truncate(
            getShortPackageName(script.packageName),
            packageDisplayWidth
          );
          const packageTag = `${colors.cyan}[${shortPkg}]${colors.reset}`;
          const paddedPackageTag =
            packageTag + " ".repeat(packageDisplayWidth - shortPkg.length);
          return `${colors.cyan}❯${colors.reset} ${checkMark}${orderPrefix}${sourceTag}${colors.cyan}${icon}${colors.reset} ${colors.cyan}${colors.bold}${script.name.padEnd(maxNameLength)}${colors.reset}  ${paddedPackageTag}  ${colors.dim}${truncatedCommand}${colors.reset}`;
        }
        return `${colors.cyan}❯${colors.reset} ${checkMark}${orderPrefix}${sourceTag}${colors.cyan}${icon}${colors.reset} ${colors.cyan}${colors.bold}${script.name.padEnd(maxNameLength)}${colors.reset}  ${colors.dim}${truncatedCommand}${colors.reset}`;
      }
    }

    // Non-focused items
    const script = scripts.find((s) => getScriptKey(s) === choice.value);
    if (script) {
      const icon = getIcon(script.name, script.source);
      const iconColor = getIconColor(script.name, script.source);
      const truncatedCommand = truncate(script.command, maxCommandLength);
      const checkMark = isSelected
        ? `${colors.green}◉${colors.reset} `
        : `${colors.dim}○${colors.reset} `;
      const sourceTag = hasBothSources
        ? `${script.source === "npm" ? colors.green : colors.yellow}[${script.source}]${colors.reset} `
        : "";

      if (isMonorepo && script.packageName) {
        const shortPkg = truncate(
          getShortPackageName(script.packageName),
          packageDisplayWidth
        );
        const packageTag = `${colors.dim}[${shortPkg}]${colors.reset}`;
        const paddedPackageTag =
          packageTag + " ".repeat(packageDisplayWidth - shortPkg.length);
        return `  ${checkMark}${orderPrefix}${sourceTag}${iconColor}${icon}${colors.reset} ${script.name.padEnd(maxNameLength)}  ${paddedPackageTag}  ${colors.dim}${truncatedCommand}${colors.reset}`;
      }
      return `  ${checkMark}${orderPrefix}${sourceTag}${iconColor}${icon}${colors.reset} ${script.name.padEnd(maxNameLength)}  ${colors.dim}${truncatedCommand}${colors.reset}`;
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
        console.log("No script selected.");
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
      console.log("");
    }

    for (const scriptKey of selectedScriptKeys) {
      const script = scripts.find((s) => getScriptKey(s) === scriptKey);

      if (!script) {
        continue;
      }

      if (selectedScriptKeys.length > 1 || isMonorepo) {
        const location = script.packageName
          ? ` ${colors.dim}(${script.packageName})${colors.reset}`
          : "";
        console.log(
          `\n${colors.green}▶${colors.reset} Running: ${colors.bold}${script.name}${colors.reset}${location}\n`
        );
      }

      await runScript(script.name, script.packagePath, script.source);
    }
  } catch (error) {
    // User cancelled (Ctrl+C)
    if ((error as Error).message?.includes("cancelled")) {
      return;
    }
    console.error("Error:", error);
  }
}
