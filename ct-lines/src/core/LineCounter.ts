import * as fs from 'fs/promises';
import * as path from 'path';
import { glob, Options as GlobOptions } from 'fast-glob';
import ProgressBar from 'progress';
import { LineCounterTable, LanguageConf } from '../lib/LineCounterTable';
import { internalDefinitions } from '../lib/internalDefinitions';
import Gitignore from '../lib/Gitignore';
import { TokenCounter, TokenCount } from '../lib/TokenCounter';
import { Count } from '../models/Count';
import { ResultFormatter } from '../formatters/ResultFormatter';

interface Result {
    filePath: string;
    language: string;
    count: Count;
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

export class LineCounter {
    private targetDir: string;
    private options: Options;
    private languageDefinitions: Map<string, LanguageConf>;

    constructor(targetDir: string, options: Options) {
        this.targetDir = path.resolve(targetDir);
        this.options = options;
        this.languageDefinitions = new Map<string, LanguageConf>(Object.entries(internalDefinitions) as [string, LanguageConf][]);
    }

    async loadLanguageDefinitions() {
        if (this.options.languageConf) {
            try {
                const customDefs = JSON.parse(await fs.readFile(this.options.languageConf, 'utf8'));
                this.languageDefinitions = new Map([
                    ...Object.entries(internalDefinitions) as [string, LanguageConf][],
                    ...Object.entries(customDefs) as [string, LanguageConf][]
                ]);
            } catch (e) {
                throw new Error(`Failed to load language configuration from ${this.options.languageConf}: ${e}`);
            }
        }
    }

    private async loadGitignore(): Promise<Gitignore | undefined> {
        if (!this.options.useGitignore) return undefined;

        const globOptions: GlobOptions = {
            cwd: this.targetDir,
            ignore: this.options.exclude,
            absolute: true,
            onlyFiles: true
        };

        const gitignoreFiles = await glob('**/.gitignore', globOptions);
        const gitignoreContents = await Promise.all(
            gitignoreFiles.map(async file => ({
                content: await fs.readFile(file, 'utf8'),
                dir: path.dirname(file)
            }))
        );

        return gitignoreContents.reduce(
            (acc, { content, dir }) => acc.merge(new Gitignore(content, dir)),
            new Gitignore('')
        );
    }

    private async findFiles(): Promise<string[]> {
        const excludePatterns = [
            ...this.options.exclude,
            '**/node_modules/**',
            '**/.git/**',
            'ct-lines-result/**',
            this.options.outputDir ? path.relative(this.targetDir, this.options.outputDir) + '/**' : ''
        ].filter(Boolean);

        const globOptions: GlobOptions = {
            cwd: this.targetDir,
            ignore: excludePatterns,
            absolute: true,
            onlyFiles: true
        };

        return await glob(this.options.include, globOptions);
    }

    private async processFiles(files: string[], gitignore?: Gitignore): Promise<Result[]> {
        const targetFiles = gitignore
            ? files.filter(f => gitignore.excludes(f))
            : files;

        if (targetFiles.length === 0) {
            throw new Error('No files found to count.');
        }

        const bar = new ProgressBar('[:bar] :percent :etas', {
            total: targetFiles.length,
            width: 40
        });

        const results: Result[] = [];
        const decoder = new TextDecoder(this.options.encoding);
        const tokenCounter = new TokenCounter();
        const counterTable = new LineCounterTable(this.languageDefinitions, []);

        for (const filePath of targetFiles) {
            try {
                const counter = counterTable.getCounter(filePath);
                if (counter) {
                    const content = await fs.readFile(filePath);
                    const text = decoder.decode(content);
                    const count = counter.count(text, this.options.includeIncompleteLine);
                    const tokenCount = new TokenCount(tokenCounter.countTokens(text, filePath));
                    results.push({
                        filePath,
                        language: counter.name,
                        count,
                        tokenCount
                    });
                } else if (!this.options.ignoreUnsupported) {
                    results.push({
                        filePath,
                        language: '(Unsupported)',
                        count: new Count(),
                        tokenCount: new TokenCount()
                    });
                }
            } catch (error) {
                console.error(`Error processing ${filePath}:`, error);
            }
            bar.tick();
        }

        tokenCounter.free();
        return results;
    }

    private async generateOutputFiles(results: Result[], formatter: ResultFormatter) {
        if (!this.options.outputDir) {
            this.options.outputDir = path.join(this.targetDir, 'ct-lines-result');
        }

        console.log(`Generating results in ${this.options.outputDir}...`);
        await fs.mkdir(this.options.outputDir, { recursive: true });
        await fs.writeFile(path.join(this.options.outputDir, 'results.json'), formatter.toJson());
        
        if (this.options.outputAsText) {
            await fs.writeFile(path.join(this.options.outputDir, 'results.txt'), formatter.toText());
        }
        
        // Generate CSV files by default
        await fs.writeFile(path.join(this.options.outputDir, 'files.csv'), formatter.toFilesCsv());
        await fs.writeFile(path.join(this.options.outputDir, 'directories.csv'), formatter.toDirectoriesCsv());
        console.log('CSV files generated successfully.');
        
        if (this.options.outputAsMarkdown) {
            await fs.writeFile(path.join(this.options.outputDir, 'results.md'), formatter.toMarkdown());
            await fs.writeFile(path.join(this.options.outputDir, 'details.md'), formatter.toMarkdown(true));
        }

        await fs.writeFile(path.join(this.options.outputDir, 'README.md'), `# Line Count Results

Generated on: ${new Date().toISOString()}
Target Directory: ${this.targetDir}

This directory contains the following files:

- \`results.json\`: Raw data in JSON format
${this.options.outputAsText ? '- `results.txt`: Human-readable text format\n' : ''}- \`files.csv\`: CSV format with detailed file information
- \`directories.csv\`: CSV format with directory summaries
${this.options.outputAsMarkdown ? '- `results.md`: Summary in markdown format\n- `details.md`: Detailed breakdown by language in markdown format\n' : ''}`);
    }

    async run(): Promise<string> {
        console.log(`Starting line count in: ${this.targetDir}`);
        
        await this.loadLanguageDefinitions();
        const gitignore = await this.loadGitignore();
        const files = await this.findFiles();
        const results = await this.processFiles(files, gitignore);

        const formatter = new ResultFormatter(this.targetDir, results, {
            printCommas: this.options.printCommas,
            countDirectLevelFiles: true
        });

        let summaryOutput: string;
        switch (this.options.outputFormat) {
            case 'json':
                summaryOutput = formatter.toJson();
                break;
            case 'csv':
                console.log('Generating CSV file...');
                summaryOutput = formatter.toCsv();
                break;
            case 'markdown':
                summaryOutput = formatter.toMarkdown();
                break;
            case 'text':
            default:
                summaryOutput = formatter.toTextLimited();
                break;
        }

        if (this.options.generateResults) {
            await this.generateOutputFiles(results, formatter);
        }

        return summaryOutput;
    }
} 