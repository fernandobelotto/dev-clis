#!/usr/bin/env bun
import { program } from 'commander';
import { execa } from 'execa';
import enquirer from 'enquirer';

type PortInfo = { command: string; pid: string; user: string; port: string; name: string };

// Define a minimal interface for the Enquirer choice object we use
interface EnquirerChoice {
  name: string;    // Used internally by enquirer?
  value: string;   // The actual value returned
  message: string; // Displayed in the list
  port: string;    // Custom property for filtering
}

// Define a minimal interface for the Enquirer AutoComplete prompt options
interface EnquirerAutoCompletePromptOptions {
  name: string;
  message: string;
  limit?: number;
  multiple?: boolean;
  choices: EnquirerChoice[];
  suggest(input: string, choices: EnquirerChoice[]): EnquirerChoice[];
  result?(names: string[]): string[]; // Returns the selected values (PIDs)
}

// Define a minimal interface for the Enquirer AutoComplete prompt instance
interface EnquirerAutoCompletePrompt {
  run(): Promise<string[]>; // The type of the resolved value from result()
}

async function getPorts(): Promise<PortInfo[]> {
  // Use lsof to get ports in use (macOS/Linux)
  try {
    const { stdout } = await execa('lsof', ['-iTCP', '-sTCP:LISTEN', '-Pn']);
    const lines = stdout.split('\n').slice(1); // skip header

    const ports: PortInfo[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        // Basic split, but be mindful command names could have spaces (lsof often truncates)
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9) { // Need at least ~9 fields typically ending in NAME (state)
           // console.warn(`Skipping short lsof line: "${line}"`); // Optional: uncomment for debugging
           continue;
        }

        const command = parts[0];
        const pid = parts[1];
        const user = parts[2];

        // Ensure '(LISTEN)' is present (though -sTCP:LISTEN should guarantee it)
        // This helps anchor our search for the network address
        const listenIndex = line.lastIndexOf('(LISTEN)');
        if (listenIndex === -1) {
            // console.warn(`Skipping line without (LISTEN): "${line}"`); // Optional: uncomment for debugging
            continue;
        }

        // Extract the network address part (e.g., "[::1]:5173", "*:8080")
        // It's typically the field right before '(LISTEN)'
        const addressEndIndex = listenIndex - 1; // Index right before '('
        // Find the start of the address by looking for the space before it
        const addressStartIndex = line.lastIndexOf(' ', addressEndIndex -1) + 1;
        if (addressStartIndex === 0) { // Checking result of lastIndexOf(' ') + 1
             // console.warn(`Could not find start of network address: "${line}"`); // Optional: uncomment for debugging
             continue; // Could not determine address start
        }

        const networkAddress = line.substring(addressStartIndex, addressEndIndex).trim();

        // Extract port from the *end* of the network address
        const portMatch = networkAddress.match(/:(\d+)$/); // Match ':port' at the very end
        if (!portMatch) {
             // console.warn(`Could not extract port from address "${networkAddress}" in line: "${line}"`); // Optional: uncomment for debugging
             continue; // Didn't find ':port' at the end
        }
        const port = portMatch[1];

        // Use the cleaner networkAddress for the name property
        ports.push({ command, pid, user, port, name: networkAddress });

      } catch (e) {
        // Log specific parsing errors for a line
        console.error(`Failed to parse lsof line: "${line}"`, e);
      }
    }

    // Remove duplicates by port (keeps the first entry found for each port)
    const seen = new Set<string>();
    return ports.filter((p: PortInfo) => {
      if (seen.has(p.port)) {
        // console.log(`Filtering duplicate port ${p.port} from PID ${p.pid} (${p.name})`); // Optional: Debug duplicate filtering
        return false;
      }
      seen.add(p.port);
      return true;
    });
  } catch (err) {
    // Log errors during lsof execution or top-level processing
    console.error('Failed to execute or process lsof:', err);
    return [];
  }
}

async function killProcess(pid: string) {
  try {
    process.kill(Number(pid), 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

// Filter ports based on user input for enquirer's suggest function
// The suggest function expects the filtered choices directly, not a promise
function suggestPorts(choices: EnquirerChoice[], input: string): EnquirerChoice[] {
  input = (input || '').toLowerCase();
  const inputTerms = input.split(' ').filter(term => term.trim() !== ''); // Ensure terms are trimmed and not empty

  return choices.filter((choice) => {
    // With no input, include all choices
    if (!input) return true;

    // Check for exact port number match first
    if (choice.port === input) return true;

    const choiceNameLower = choice.name.toLowerCase();
    const choicePort = choice.port;

    // For multiple terms, all terms must match name or port
    return inputTerms.every(term =>
      choiceNameLower.includes(term) || choicePort.includes(term)
    );
  });
}

async function interactivePortKiller() {
  const ports = await getPorts();
  if (!ports.length) {
    console.log('No listening ports found.');
    return;
  }

  // Prepare choices for enquirer Autocomplete
  const choices: EnquirerChoice[] = ports.map((p: PortInfo) => ({
    name: `${p.port} (${p.command} - PID ${p.pid})`, // Display name
    value: p.pid, // Return value (PID)
    // Add original port info for filtering
    port: p.port,
    // message is used by enquirer for display in the list
    message: `${p.port} (${p.command} - PID ${p.pid})`
  }));

  try {
    // Use enquirer's Autocomplete prompt with our defined types
    // Cast to unknown first as suggested by the linter
    const AutoCompletePrompt = (enquirer as unknown as { AutoComplete: new (options: EnquirerAutoCompletePromptOptions) => EnquirerAutoCompletePrompt }).AutoComplete;
    const prompt = new AutoCompletePrompt({
      name: 'selectedPids',
      message: 'Select port(s) to kill (type to filter, use arrows, space to select, enter to confirm):',
      limit: 10, // Similar to pageSize
      multiple: true, // Allow multiple selections
      choices: choices, // Initial full list of choices
      suggest(input: string, choices: EnquirerChoice[]) {
         // The 'choices' passed here are the structured objects we defined above
        return suggestPorts(choices, input);
      },
       // Map selected choices back to just their values (PIDs)
      result(names: string[]) { // names are the 'message' values of the selected choices
        // Find the original choice objects based on the message (which is unique here)
        const nameToChoiceMap = new Map(choices.map(c => [c.message, c]));
        const selectedValues = names.map(name => nameToChoiceMap.get(name)?.value).filter((v): v is string => v !== undefined);
        return selectedValues;
      }
    });

    const selectedPids = await prompt.run();

    if (!selectedPids || !selectedPids.length) {
      console.log('No ports selected.');
      return;
    }
    
    const selectedPorts = ports.filter(p => selectedPids.includes(p.pid));
    
    console.log(`Killing ${selectedPids.length} process(es)...`);
    for (const pid of selectedPids) {
      const portInfo = selectedPorts.find(p => p.pid === pid);
      const ok = await killProcess(pid);
      if (ok) {
        console.log(`✅ Killed process ${pid} (${portInfo ? `port ${portInfo.port}` : 'unknown port'})`);
      } else {
        console.log(`❌ Failed to kill process ${pid} (${portInfo ? `port ${portInfo.port}` : 'unknown port'})`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

program
  .name('pscan')
  .description('Interactive port scanner and killer')
  .version('1.0.0')
  .action(interactivePortKiller);

program.parse(); 