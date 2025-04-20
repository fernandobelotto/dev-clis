import { EnquirerChoice } from "./interfaces";

export function suggestPorts(choices: EnquirerChoice[], input: string): EnquirerChoice[] {
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