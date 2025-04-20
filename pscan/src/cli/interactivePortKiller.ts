
import enquirer from 'enquirer';
import { getPorts } from './getPorts';
import { EnquirerAutoCompletePrompt, EnquirerAutoCompletePromptOptions } from './interfaces';
import { EnquirerChoice, PortInfo } from './interfaces';
import { suggestPorts } from './suggestPorts';
import { killProcess } from './killProcess';

export async function interactivePortKiller() {
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