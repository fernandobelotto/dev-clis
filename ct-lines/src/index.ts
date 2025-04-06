#!/usr/bin/env bun
import { program } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob, Options as GlobOptions } from 'fast-glob';
import ProgressBar from 'progress';
import { LineCounterTable, LanguageConf } from './lib/LineCounterTable';
import { internalDefinitions } from './lib/internalDefinitions';
import Gitignore from './lib/Gitignore';
import { Count } from './lib/LineCounter';
import { TokenCounter, TokenCount } from './lib/TokenCounter';

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
}

class ResultFormatter {
    private dirResultTable = new Map<string, Statistics>();
    private langResultTable = new Map<string, Statistics>();
    private total = new Statistics('Total');
    private valueToString: (obj: any) => string;

    constructor(
        private targetDir: string,
        private results: Result[],
        private options: {
            printCommas: boolean;
            countDirectLevelFiles: boolean;
        }
    ) {
        this.valueToString = options.printCommas ? this.toStringWithCommas : (obj: any) => obj.toString();

        const directLevelResultTable = new Map<string, Statistics>();
        results.forEach((result) => {
            let parent = path.dirname(path.relative(this.targetDir, result.filePath));
            getOrSet(directLevelResultTable, parent, () => new Statistics(parent + " (Files)")).add(Object.assign(result.count, { tokenCount: result.tokenCount }));
            while (parent.length >= 0) {
                getOrSet(this.dirResultTable, parent, () => new Statistics(parent)).add(Object.assign(result.count, { tokenCount: result.tokenCount }));
                const p = path.dirname(parent);
                if (p === parent) {
                    break;
                }
                parent = p;
            }
            getOrSet(this.langResultTable, result.language, () => new Statistics(result.language)).add(Object.assign(result.count, { tokenCount: result.tokenCount }));
            this.total.add(Object.assign(result.count, { tokenCount: result.tokenCount }));
        });

        if (options.countDirectLevelFiles) {
            [...directLevelResultTable.entries()].filter(([key, value]) => {
                return value.total !== (this.dirResultTable.get(key)?.total ?? 0);
            }).forEach(([, value]) => this.dirResultTable.set(value.name, value));
        }
    }

    private toStringWithCommas(obj: any) {
        if (typeof obj === 'number') {
            return new Intl.NumberFormat('en-US').format(obj);
        } else {
            return obj.toString();
        }
    }

    toText() {
        const maxNamelen = Math.max(...this.results.map(res => res.filePath.length));
        const maxLanglen = Math.max(...[...this.langResultTable.keys()].map(l => l.length));
        const resultFormat = new TextTableFormatter(this.valueToString, 
            { title: 'filename', width: maxNamelen }, 
            { title: 'language', width: maxLanglen },
            { title: 'code', width: 10 }, 
            { title: 'comment', width: 10 }, 
            { title: 'blank', width: 10 }, 
            { title: 'total', width: 10 },
            { title: 'tokens', width: 10 }
        );
        const dirFormat = new TextTableFormatter(this.valueToString, 
            { title: 'path', width: maxNamelen }, 
            { title: 'files', width: 10 },
            { title: 'code', width: 10 }, 
            { title: 'comment', width: 10 }, 
            { title: 'blank', width: 10 }, 
            { title: 'total', width: 10 },
            { title: 'tokens', width: 10 }
        );
        const langFormat = new TextTableFormatter(this.valueToString, 
            { title: 'language', width: maxLanglen }, 
            { title: 'files', width: 10 },
            { title: 'code', width: 10 }, 
            { title: 'comment', width: 10 }, 
            { title: 'blank', width: 10 }, 
            { title: 'total', width: 10 },
            { title: 'tokens', width: 10 }
        );

        return [
            `Directory : ${this.targetDir}`,
            `Total : ${this.total.files} files,  ${this.total.code} codes, ${this.total.comment} comments, ${this.total.blank} blanks, all ${this.total.total} lines, ${this.total.tokenCount.tokens} tokens`,
            '',
            'Languages',
            ...langFormat.headerLines,
            ...[...this.langResultTable.values()].sort((a, b) => b.code - a.code)
                .map(v => langFormat.line(v.name, v.files, v.code, v.comment, v.blank, v.total, v.tokenCount.tokens)),
            ...langFormat.footerLines,
            '',
            'Directories',
            ...dirFormat.headerLines,
            ...[...this.dirResultTable.values()].sort((a, b) => a.name.localeCompare(b.name))
                .map(v => dirFormat.line(v.name, v.files, v.code, v.comment, v.blank, v.total, v.tokenCount.tokens)),
            ...dirFormat.footerLines,
            '',
            'Files',
            ...resultFormat.headerLines,
            ...this.results.sort((a, b) => a.filePath.localeCompare(b.filePath))
                .map(v => resultFormat.line(v.filePath, v.language, v.count.code, v.count.comment, v.count.blank, v.count.total, v.tokenCount.tokens)),
            resultFormat.line('Total', '', this.total.code, this.total.comment, this.total.blank, this.total.total, this.total.tokenCount.tokens),
            ...resultFormat.footerLines,
        ].join('\n');
    }

    toJson() {
        return JSON.stringify({
            directory: this.targetDir,
            total: {
                files: this.total.files,
                code: this.total.code,
                comment: this.total.comment,
                blank: this.total.blank,
                total: this.total.total,
                tokens: this.total.tokenCount.tokens
            },
            languages: Object.fromEntries([...this.langResultTable.entries()].map(([k, v]) => [k, {
                files: v.files,
                code: v.code,
                comment: v.comment,
                blank: v.blank,
                total: v.total,
                tokens: v.tokenCount.tokens
            }])),
            directories: Object.fromEntries([...this.dirResultTable.entries()].map(([k, v]) => [k, {
                files: v.files,
                code: v.code,
                comment: v.comment,
                blank: v.blank,
                total: v.total,
                tokens: v.tokenCount.tokens
            }])),
            files: this.results.map(v => ({
                path: v.filePath,
                language: v.language,
                code: v.count.code,
                comment: v.count.comment,
                blank: v.count.blank,
                total: v.count.total,
                tokens: v.tokenCount.tokens
            }))
        }, null, 2);
    }

    toCsv() {
        const languages = [...this.langResultTable.keys()];
        return [
            `"filename","language","${languages.join('","')}","comment","blank","total"`,
            ...this.results.sort((a, b) => a.filePath.localeCompare(b.filePath))
                .map(v => `"${v.filePath}","${v.language}",${languages.map(l => l === v.language ? v.count.code : 0).join(',')},${v.count.comment},${v.count.blank},${v.count.total}`),
            `"Total","-",${[...this.langResultTable.values()].map(r => r.code).join(',')},${this.total.comment},${this.total.blank},${this.total.total}`
        ].join('\n');
    }

    toMarkdown(isDetails: boolean = false) {
        const date = new Date();
        return [
            ...this.toMarkdownHeaderLines(date, isDetails),
            '',
            ...this.toMarkdownSummaryLines(),
            '',
            ...this.toMarkdownDetailsLines(isDetails),
        ].join('\n');
    }

    private toMarkdownHeaderLines(date: Date, isDetails: boolean) {
        return [
            `# ${isDetails ? 'Details' : 'Summary'}`,
            '',
            `Date : ${date.toISOString().split('T')[0]}`,
            '',
            `Directory: ${this.targetDir.replace(/\\/g, '\\\\')}`,
            '',
            `Total Files : ${this.total.files}`,
            `Lines of Code : ${this.total.code}`,
            `Comments : ${this.total.comment}`,
            `Blank Lines : ${this.total.blank}`,
            `Total Lines : ${this.total.total}`,
            `Total Tokens : ${this.total.tokenCount.tokens}`,
            '',
            isDetails ? '[Summary](./results.md)' : '[Details](./details.md)',
            '',
        ];
    }

    private toMarkdownSummaryLines() {
        const dirFormat = new MarkdownTableFormatter(this.valueToString,
            { title: 'Path', format: 'string' },
            { title: 'Files', format: 'number' },
            { title: 'Code', format: 'number' },
            { title: 'Comments', format: 'number' },
            { title: 'Blanks', format: 'number' },
            { title: 'Total', format: 'number' },
            { title: 'Tokens', format: 'number' }
        );
        const langFormat = new MarkdownTableFormatter(this.valueToString,
            { title: 'Language', format: 'string' },
            { title: 'Files', format: 'number' },
            { title: 'Code', format: 'number' },
            { title: 'Comments', format: 'number' },
            { title: 'Blanks', format: 'number' },
            { title: 'Total', format: 'number' },
            { title: 'Tokens', format: 'number' }
        );
        return [
            '## Languages',
            ...langFormat.headerLines,
            ...[...this.langResultTable.values()].sort((a, b) => b.code - a.code)
                .map(v => langFormat.line(v.name, v.files, v.code, v.comment, v.blank, v.total, v.tokenCount.tokens)),
            '',
            '## Directories',
            ...dirFormat.headerLines,
            ...[...this.dirResultTable.values()].sort((a, b) => a.name.localeCompare(b.name))
                .map(v => dirFormat.line(v.name.replace(/\\/g, '\\\\'), v.files, v.code, v.comment, v.blank, v.total, v.tokenCount.tokens)),
        ];
    }

    private toMarkdownDetailsLines(isDetails: boolean) {
        if (!isDetails) {
            return [];
        }

        const resultFormat = new MarkdownTableFormatter(this.valueToString,
            { title: 'Filename', format: 'string' },
            { title: 'Language', format: 'string' },
            { title: 'Code', format: 'number' },
            { title: 'Comments', format: 'number' },
            { title: 'Blanks', format: 'number' },
            { title: 'Total', format: 'number' },
            { title: 'Tokens', format: 'number' }
        );

        const byLanguage = new Map<string, Result[]>();
        this.results.forEach(result => {
            const list = byLanguage.get(result.language) || [];
            list.push(result);
            byLanguage.set(result.language, list);
        });

        const sections = [...byLanguage.entries()]
            .sort((a, b) => {
                const totalA = a[1].reduce((sum, r) => sum + r.count.code, 0);
                const totalB = b[1].reduce((sum, r) => sum + r.count.code, 0);
                return totalB - totalA;
            })
            .map(([language, files]) => [
                `### ${language}`,
                '',
                ...resultFormat.headerLines,
                ...files.sort((a, b) => a.filePath.localeCompare(b.filePath))
                    .map(v => resultFormat.line(
                        v.filePath.replace(/\\/g, '\\\\'),
                        v.language,
                        v.count.code,
                        v.count.comment,
                        v.count.blank,
                        v.count.total,
                        v.tokenCount.tokens
                    )),
                ''
            ].join('\n'));

        return [
            '## Files',
            '',
            ...sections
        ];
    }
}

class Statistics extends Count {
    public name: string;
    public files = 0;
    public tokenCount = new TokenCount();

    constructor(name: string) {
        super();
        this.name = name;
    }

    override add(value: Count & { tokenCount?: TokenCount }) {
        this.files++;
        if (value.tokenCount) {
            this.tokenCount.add(value.tokenCount);
        }
        return super.add(value);
    }
}

class TextTableFormatter {
    private valueToString: (obj: any) => string;
    private columnInfo: { title: string, width: number }[];

    constructor(valueToString: (obj: any) => string, ...columnInfo: { title: string, width: number }[]) {
        this.valueToString = valueToString;
        this.columnInfo = columnInfo;
        for (const info of this.columnInfo) {
            info.width = Math.max(info.title.length, info.width);
        }
    }

    public get lineSeparator() {
        return '+-' + this.columnInfo.map(i => '-'.repeat(i.width)).join('-+-') + '-+';
    }

    get headerLines() {
        return [this.lineSeparator, '| ' + this.columnInfo.map(i => i.title.padEnd(i.width)).join(' | ') + ' |', this.lineSeparator];
    }

    get footerLines() {
        return [this.lineSeparator];
    }

    public line(...data: (string | number)[]) {
        return '| ' + data.map((d, i) => {
            if (typeof d === 'string') {
                return d.padEnd(this.columnInfo[i].width);
            } else {
                return this.valueToString(d).padStart(this.columnInfo[i].width);
            }
        }).join(' | ') + ' |';
    }
}

class MarkdownTableFormatter {
    private valueToString: (obj: any) => string;
    private columnInfo: { title: string, format: string }[];

    constructor(valueToString: (obj: any) => string, ...columnInfo: { title: string, format: string }[]) {
        this.valueToString = valueToString;
        this.columnInfo = columnInfo;
    }

    get lineSeparator() {
        return '| ' + this.columnInfo.map(i => (i.format === 'number') ? '---:' : ':---').join(' | ') + ' |';
    }

    get headerLines() {
        return ['| ' + this.columnInfo.map(i => i.title).join(' | ') + ' |', this.lineSeparator];
    }

    public line(...data: (string | number)[]) {
        return '| ' + data.map((d, i) => {
            if (typeof d === 'number') {
                return this.valueToString(d);
            } else {
                return d;
            }
        }).join(' | ') + ' |';
    }
}

const getOrSet = <K, V>(map: Map<K, V>, key: K, otherwise: () => V) => {
    let v = map.get(key);
    if (v === undefined) {
        v = otherwise();
        map.set(key, v);
    }
    return v;
};

program
    .name('count-lines')
    .description('Counts lines of code, comments, and blank lines in files within a directory.')
    .version('1.0.0')
    .argument('<directory>', 'The directory to scan for files.')
    .option('-i, --include <pattern>', 'Glob patterns for files to include (can be specified multiple times).', ['**/*'])
    .option('-e, --exclude <pattern>', 'Glob patterns for files/directories to exclude (can be specified multiple times).', [])
    .option('--use-gitignore', 'Use .gitignore files found in the target directory to exclude files.', true)
    .option('--language-conf <path>', 'Path to a custom JSON file defining or overriding language configurations.')
    .option('-f, --output-format <format>', 'Format for the summary output (text, json, csv, markdown).', 'text')
    .option('-o, --output-dir <path>', 'Directory to save detailed results files. Defaults to "count-lines-result" in the target directory.')
    .option('--encoding <encoding>', 'File encoding to use when reading files.', 'utf8')
    .option('--ignore-unsupported', 'Ignore files for which no language definition is found.', true)
    .option('--include-incomplete-line', 'Count the last line even if it doesn\'t end with a newline.', false)
    .option('--print-commas', 'Print numbers with commas.', true)
    .option('--output-as-text', 'Generate text output file when using --output-dir.', true)
    .option('--output-as-csv', 'Generate CSV output file when using --output-dir.', true)
    .option('--output-as-markdown', 'Generate markdown output files when using --output-dir.', true)
    .action(async (directory: string, options: Options) => {
        try {
            // 1. Determine Target Directory (absolute path)
            const targetDir = path.resolve(directory);
            console.log(`Starting line count in: ${targetDir}`);

            // Set default output directory if not specified
            if (!options.outputDir) {
                options.outputDir = path.join(targetDir, 'count-lines-result');
            }

            // 2. Load Language Definitions
            let languageDefinitions = new Map<string, LanguageConf>(Object.entries(internalDefinitions) as [string, LanguageConf][]);
            if (options.languageConf) {
                try {
                    const customDefs = JSON.parse(await fs.readFile(options.languageConf, 'utf8'));
                    languageDefinitions = new Map([
                        ...Object.entries(internalDefinitions) as [string, LanguageConf][],
                        ...Object.entries(customDefs) as [string, LanguageConf][]
                    ]);
                } catch (e) {
                    console.error(`Failed to load language configuration from ${options.languageConf}:`, e);
                    process.exit(1);
                }
            }

            // 3. Initialize LineCounterTable
            const counterTable = new LineCounterTable(languageDefinitions, []);

            // 4. Prepare Glob Patterns
            const includePatterns = options.include;
            const excludePatterns = [
                ...options.exclude,
                '**/node_modules/**',
                '**/.git/**',
                'count-lines-result/**',
                options.outputDir ? path.relative(targetDir, options.outputDir) + '/**' : ''
            ].filter(Boolean);

            // 5. Find Files using Glob
            const globOptions: GlobOptions = {
                cwd: targetDir,
                ignore: excludePatterns,
                absolute: true,
                onlyFiles: true
            };
            const files = await glob(includePatterns, globOptions);

            // 6. Load .gitignore (if options.useGitignore)
            let gitignore: Gitignore | undefined;
            if (options.useGitignore) {
                const gitignoreFiles = await glob('**/.gitignore', globOptions);
                const gitignoreContents = await Promise.all(
                    gitignoreFiles.map(async file => ({
                        content: await fs.readFile(file, 'utf8'),
                        dir: path.dirname(file)
                    }))
                );
                gitignore = gitignoreContents.reduce(
                    (acc, { content, dir }) => acc.merge(new Gitignore(content, dir)),
                    new Gitignore('')
                );
            }

            // 7. Filter Files based on .gitignore
            const targetFiles = gitignore
                ? files.filter(f => gitignore!.excludes(f))
                : files;

            if (targetFiles.length === 0) {
                console.log('No files found to count.');
                return;
            }

            // 8. Initialize Progress Bar
            const bar = new ProgressBar('[:bar] :percent :etas', {
                total: targetFiles.length,
                width: 40
            });

            // 9. Process Files
            const results: Result[] = [];
            const decoder = new TextDecoder(options.encoding);
            const tokenCounter = new TokenCounter();

            for (const filePath of targetFiles) {
                try {
                    const counter = counterTable.getCounter(filePath);
                    if (counter) {
                        const content = await fs.readFile(filePath);
                        const text = decoder.decode(content);
                        const count = counter.count(text, options.includeIncompleteLine);
                        const tokenCount = new TokenCount(tokenCounter.countTokens(text, filePath));
                        results.push({
                            filePath,
                            language: counter.name,
                            count,
                            tokenCount
                        });
                    } else if (!options.ignoreUnsupported) {
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

            // Free the token counter
            tokenCounter.free();

            // 10. Format Results
            const formatter = new ResultFormatter(targetDir, results, {
                printCommas: options.printCommas,
                countDirectLevelFiles: true
            });

            let summaryOutput: string;
            switch (options.outputFormat) {
                case 'json':
                    summaryOutput = formatter.toJson();
                    break;
                case 'csv':
                    summaryOutput = formatter.toCsv();
                    break;
                case 'markdown':
                    summaryOutput = formatter.toMarkdown();
                    break;
                case 'text':
                default:
                    summaryOutput = formatter.toText();
            }

            // 11. Output Results
            await fs.mkdir(options.outputDir, { recursive: true });
            await fs.writeFile(path.join(options.outputDir, 'results.json'), formatter.toJson());
            
            if (options.outputAsText) {
                await fs.writeFile(path.join(options.outputDir, 'results.txt'), formatter.toText());
            }
            
            if (options.outputAsCSV) {
                await fs.writeFile(path.join(options.outputDir, 'results.csv'), formatter.toCsv());
            }
            
            if (options.outputAsMarkdown) {
                await fs.writeFile(path.join(options.outputDir, 'results.md'), formatter.toMarkdown());
                await fs.writeFile(path.join(options.outputDir, 'details.md'), formatter.toMarkdown(true));
            }

            // Create a README file in the output directory
            await fs.writeFile(path.join(options.outputDir, 'README.md'), `# Line Count Results

Generated on: ${new Date().toISOString()}
Target Directory: ${targetDir}

This directory contains the following files:

- \`results.json\`: Raw data in JSON format
${options.outputAsText ? '- `results.txt`: Human-readable text format\n' : ''}${options.outputAsCSV ? '- `results.csv`: CSV format for spreadsheet applications\n' : ''}${options.outputAsMarkdown ? '- `results.md`: Summary in markdown format\n- `details.md`: Detailed breakdown by language in markdown format\n' : ''}`);
            
            console.log(`Results saved to ${options.outputDir}`);
            console.log(summaryOutput);
        } catch (error) {
            console.error('Error:', error);
            process.exit(1);
        }
    });

program.parse(); 