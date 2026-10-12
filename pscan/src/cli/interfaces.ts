
export type PortInfo = { command: string; pid: string; user: string; port: string; name: string };

// Define a minimal interface for the Enquirer choice object we use
export interface EnquirerChoice {
  name: string;    // Used internally by enquirer?
  value: string;   // The actual value returned
  message: string; // Displayed in the list
  port: string;    // Custom property for filtering
}

// Define a minimal interface for the Enquirer AutoComplete prompt options
export interface EnquirerAutoCompletePromptOptions {
  name: string;
  message: string;
  limit?: number;
  multiple?: boolean;
  choices: EnquirerChoice[];
  suggest(input: string, choices: EnquirerChoice[]): EnquirerChoice[];
  result?(names: string[]): string[]; // Returns the selected values (PIDs)
}

// Define a minimal interface for the Enquirer AutoComplete prompt instance
export interface EnquirerAutoCompletePrompt {
  run(): Promise<string[]>; // The type of the resolved value from result()
}
