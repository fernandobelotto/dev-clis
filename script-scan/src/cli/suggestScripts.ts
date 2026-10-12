import type { EnquirerChoice } from './interfaces';

export function suggestScripts(
  choices: EnquirerChoice[],
  input: string
): EnquirerChoice[] {
  input = (input || '').toLowerCase();
  const inputTerms = input.split(' ').filter((term) => term.trim() !== '');

  return choices.filter((choice) => {
    if (!input) return true;

    const nameLower = choice.name.toLowerCase();
    const commandLower = choice.command.toLowerCase();

    // Exact match on script name
    if (nameLower === input) return true;

    // All terms must match (AND logic)
    return inputTerms.every(
      (term) => nameLower.includes(term) || commandLower.includes(term)
    );
  });
}
