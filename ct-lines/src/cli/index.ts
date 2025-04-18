import { program } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob, Options as GlobOptions } from 'fast-glob';
import ProgressBar from 'progress';
import inquirer from 'inquirer';
import { LineCounterTable, LanguageConf } from '../lib/LineCounterTable';
import { internalDefinitions } from '../lib/internalDefinitions';
import Gitignore from '../lib/Gitignore';
import { TokenCounter, TokenCount } from '../lib/TokenCounter';
import { ResultFormatter } from '../formatters/ResultFormatter';
import { Count } from '../models/Count';
import { LineCounter } from '../core/LineCounter';

interface Result {
    filePath: string;
    language: string;
    count: any;
    tokenCount: TokenCount;
}

interface Options {
    include: string[];
    exclude: string[];
    useGitignore: boolean;
    languageConf?: string;
    outputFormat: 'text' | 'json' | 'csv' | 'markdown';
    outputDir?: string;
    encoding: string;
    ignoreUnsupported: boolean;
    includeIncompleteLine: boolean;
    printCommas: boolean;
    outputAsMarkdown: boolean;
    outputAsText: boolean;
    outputAsCSV: boolean;
    generateResults?: boolean;
}

program
    .name('ct-lines')
    .description('Counts lines of code, comments, and blank lines in files within a directory.')
    .version('1.0.0')
    .argument('<directory>', 'The directory to scan for files.')
    .option('-i, --include <pattern>', 'Glob patterns for files to include (can be specified multiple times).', ['**/*'])
    .option('-e, --exclude <pattern>', 'Glob patterns for files/directories to exclude (can be specified multiple times).', [])
    .option('--use-gitignore', 'Use .gitignore files found in the target directory to exclude files.', true)
    .option('--language-conf <path>', 'Path to a custom JSON file defining or overriding language configurations.')
    .option('-f, --output-format <format>', 'Format for the summary output (text, json, csv, markdown).', 'text')
    .option('-o, --output-dir <path>', 'Directory to save detailed results files. Defaults to "ct-lines-result" in the target directory.')
    .option('--encoding <encoding>', 'File encoding to use when reading files.', 'utf8')
    .option('--ignore-unsupported', 'Ignore files for which no language definition is found.', true)
    .option('--include-incomplete-line', 'Count the last line even if it doesn\'t end with a newline.', false)
    .option('--print-commas', 'Print numbers with commas.', true)
    .option('--output-as-text', 'Generate text output file when using --output-dir.', true)
    .option('--output-as-csv', 'Generate CSV output file when using --output-dir.', true)
    .option('--output-as-markdown', 'Generate markdown output files when using --output-dir.', true)
    .option('--generate-results <boolean>', 'Generate results folder with detailed reports (true/false). If not specified, user will be prompted.', (value) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return undefined;
    })
    .action(async (directory: string, options: Options) => {
        try {
            const lineCounter = new LineCounter(directory, options);
            const summaryOutput = await lineCounter.run();
            
            // Always output the summary to console first
            console.log(summaryOutput);
            
            // Prompt the user if they want to generate result files
            let shouldGenerateResults = options.generateResults;
            if (shouldGenerateResults === undefined) {
                const answer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'generateResults',
                        message: `Would you like to generate detailed results folder at ${options.outputDir || path.join(directory, 'ct-lines-result')}?`,
                        default: true
                    }
                ]);
                shouldGenerateResults = answer.generateResults;
            }

            if (shouldGenerateResults) {
                options.generateResults = true;
                await lineCounter.run();
            }
        } catch (error) {
            console.error('Error:', error);
            process.exit(1);
        }
    });

program.parse(); 