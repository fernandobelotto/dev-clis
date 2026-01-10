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
};

// Icon palette for visual variety
const icons = ['●', '◆', '■', '▸', '★'];

function getIcon(index: number): string {
  return icons[index % icons.length] ?? '●';
}

function getIconColor(index: number): string {
  const colorKeys = ['cyan', 'green', 'yellow', 'magenta', 'blue'] as const;
  const key = colorKeys[index % colorKeys.length] ?? 'cyan';
  return colors[key];
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

interface RunnerOptions {
  multi?: boolean;
}

export async function interactiveScriptRunner(options: RunnerOptions = {}) {
  const scripts = await getScripts();

  if (scripts.length === 0) {
    return;
  }

  const termWidth = getTerminalWidth();
  const maxNameLength = Math.max(...scripts.map((s) => s.name.length));

  // Reserve space for: icon (1) + space (1) + name + spaces (2) + dim arrow (3) + space (1) + prompt prefix (~4)
  const reservedSpace = 1 + 1 + maxNameLength + 2 + 3 + 1 + 4;
  const maxCommandLength = Math.max(20, termWidth - reservedSpace);

  const choices: EnquirerChoice[] = scripts.map((s: ScriptInfo, index: number) => {
    const icon = getIcon(index);
    const iconColor = getIconColor(index);
    const truncatedCommand = truncate(s.command, maxCommandLength);

    const message = `${iconColor}${icon}${colors.reset} ${s.name.padEnd(maxNameLength)}  ${colors.dim}${truncatedCommand}${colors.reset}`;

    return {
      name: s.name,
      value: s.name,
      message,
      command: s.command,
    };
  });

  const promptOptions: EnquirerAutoCompletePromptOptions = {
    name: 'selectedScript',
    message: `${colors.cyan}Select script${colors.reset}`,
    limit: 15,
    multiple: options.multi || false,
    choices: choices,
    pointer: `${colors.cyan}❯${colors.reset}`,
    suggest(input: string, choices: EnquirerChoice[]) {
      return suggestScripts(choices, input);
    },
    result(names: string | string[]) {
      // enquirer passes the selected 'name' values which already match our script names
      return Array.isArray(names) ? names : [names];
    },
  };

  // Create prompt and override renderChoice for better highlighting
  const prompt = new AutoCompletePrompt(
    promptOptions
  ) as EnquirerAutoCompletePrompt;

  // Override the highlight method for focused items
  const originalRenderChoice = (prompt as unknown as { renderChoice: (choice: EnquirerChoice, i: number) => string }).renderChoice;
  (prompt as unknown as { renderChoice: (choice: EnquirerChoice, i: number) => string }).renderChoice = function(choice: EnquirerChoice, i: number) {
    const self = this as unknown as { index: number; input: string };
    const isFocused = i === self.index;

    if (isFocused) {
      // Find the original script to recreate the message with highlight
      const script = scripts.find((s) => s.name === choice.value);
      if (script) {
        const idx = scripts.indexOf(script);
        const icon = getIcon(idx);
        const truncatedCommand = truncate(script.command, maxCommandLength);
        return `${colors.cyan}❯${colors.reset} ${colors.cyan}${icon}${colors.reset} ${colors.cyan}${colors.bold}${script.name.padEnd(maxNameLength)}${colors.reset}  ${colors.dim}${truncatedCommand}${colors.reset}`;
      }
    }

    return originalRenderChoice.call(this, choice, i);
  };

  try {
    const result = await prompt.run();
    const selectedScripts = Array.isArray(result) ? result : [result];

    if (!selectedScripts || selectedScripts.length === 0) {
      console.log('No script selected.');
      return;
    }

    console.log('');

    for (const scriptName of selectedScripts) {
      if (selectedScripts.length > 1) {
        console.log(`\n${colors.green}▶${colors.reset} Running: ${colors.bold}${scriptName}${colors.reset}\n`);
      }
      await runScript(scriptName);
    }
  } catch (error) {
    // User cancelled (Ctrl+C)
    if ((error as Error).message?.includes('cancelled')) {
      return;
    }
    console.error('Error:', error);
  }
}
