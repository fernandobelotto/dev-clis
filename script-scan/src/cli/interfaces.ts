export interface ScriptInfo {
  name: string;
  command: string;
}

export interface EnquirerChoice {
  name: string;
  value: string;
  message: string;
  command: string;
}

export interface EnquirerAutoCompletePromptOptions {
  name: string;
  message: string;
  limit?: number;
  multiple?: boolean;
  pointer?: string;
  choices: EnquirerChoice[];
  suggest(input: string, choices: EnquirerChoice[]): EnquirerChoice[];
  result?(names: string | string[]): string[];
}

export interface EnquirerAutoCompletePrompt {
  run(): Promise<string | string[]>;
}
