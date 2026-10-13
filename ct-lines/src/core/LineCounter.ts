import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { Options as GlobOptions } from "fast-glob";
import { glob } from "fast-glob";
import ProgressBar from "progress";

import { ResultFormatter } from "../formatters/ResultFormatter";
import Gitignore from "../lib/Gitignore";
import { internalDefinitions } from "../lib/internalDefinitions";
import type { LanguageConf } from "../lib/LineCounterTable";
import { LineCounterTable } from "../lib/LineCounterTable";
import { TokenCounter, TokenCount } from "../lib/TokenCounter";
import { Count } from "../models/Count";
import * as colors from "../utils/colors";

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
  outputFormat: "text" | "json" | "csv" | "markdown";
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
    this.languageDefinitions = new Map<string, LanguageConf>(
      Object.entries(internalDefinitions) as [string, LanguageConf][]
    );
  }

  async loadLanguageDefinitions() {
    if (this.options.languageConf) {
      try {
        const customDefs = JSON.parse(
          await fs.readFile(this.options.languageConf, "utf-8")
        );
        this.languageDefinitions = new Map([
          ...(Object.entries(internalDefinitions) as [string, LanguageConf][]),
          ...(Object.entries(customDefs) as [string, LanguageConf][]),
        ]);
      } catch (error) {
        throw new Error(
          `Failed to load language configuration from ${this.options.languageConf}: ${error}`,
          { cause: error }
        );
      }
    }
  }

  private async loadGitignore(): Promise<Gitignore | undefined> {
    if (!this.options.useGitignore) {
      return undefined;
    }

    const globOptions: GlobOptions = {
      absolute: true,
      cwd: this.targetDir,
      ignore: this.options.exclude,
      onlyFiles: true,
    };

    const gitignoreFiles = await glob("**/.gitignore", globOptions);
    const gitignoreContents = await Promise.all(
      gitignoreFiles.map(async (file) => ({
        content: await fs.readFile(file, "utf-8"),
        dir: path.dirname(file),
      }))
    );

    return gitignoreContents.reduce(
      (acc, { content, dir }) => acc.merge(new Gitignore(content, dir)),
      new Gitignore("")
    );
  }

  private async findFiles(): Promise<string[]> {
    const excludePatterns = [
      ...this.options.exclude,
      "**/node_modules/**",
      "**/.git/**",
      "ct-lines-result/**",
      this.options.outputDir
        ? `${path.relative(this.targetDir, this.options.outputDir)}/**`
        : "",
    ].filter(Boolean);

    const globOptions: GlobOptions = {
      absolute: true,
      cwd: this.targetDir,
      ignore: excludePatterns,
      onlyFiles: true,
    };

    return await glob(this.options.include, globOptions);
  }

  private async processFiles(
    files: string[],
    gitignore?: Gitignore
  ): Promise<Result[]> {
    const targetFiles = gitignore
      ? files.filter((f) => gitignore.excludes(f))
      : files;

    if (targetFiles.length === 0) {
      throw new Error(colors.error("No files found to count."));
    }

    const bar = new ProgressBar(
      `${colors.info("[:bar]")} ${colors.number(":percent")} ${colors.info(":etas")}`,
      {
        complete: "=",
        incomplete: " ",
        total: targetFiles.length,
        width: 40,
      }
    );

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
          const tokenCount = new TokenCount(
            tokenCounter.countTokens(text, filePath)
          );
          results.push({
            count,
            filePath,
            language: counter.name,
            tokenCount,
          });
        } else if (!this.options.ignoreUnsupported) {
          results.push({
            count: new Count(),
            filePath,
            language: "(Unsupported)",
            tokenCount: new TokenCount(),
          });
        }
      } catch (error) {
        console.error(
          colors.error(`Error processing ${colors.filename(filePath)}:`),
          error
        );
      }
      bar.tick();
    }

    tokenCounter.free();
    return results;
  }

  private async generateOutputFiles(
    results: Result[],
    formatter: ResultFormatter
  ) {
    if (!this.options.outputDir) {
      this.options.outputDir = path.join(this.targetDir, "ct-lines-result");
    }

    console.log(
      colors.info(
        `Generating results in ${colors.highlight(this.options.outputDir)}...`
      )
    );
    await fs.mkdir(this.options.outputDir, { recursive: true });
    await fs.writeFile(
      path.join(this.options.outputDir, "results.json"),
      formatter.toJson()
    );

    if (this.options.outputAsText) {
      await fs.writeFile(
        path.join(this.options.outputDir, "results.txt"),
        formatter.toText()
      );
    }

    // Generate CSV files by default
    await fs.writeFile(
      path.join(this.options.outputDir, "files.csv"),
      formatter.toFilesCsv()
    );
    await fs.writeFile(
      path.join(this.options.outputDir, "directories.csv"),
      formatter.toDirectoriesCsv()
    );
    if (this.options.outputAsMarkdown) {
      await fs.writeFile(
        path.join(this.options.outputDir, "results.md"),
        formatter.toMarkdown()
      );
      await fs.writeFile(
        path.join(this.options.outputDir, "details.md"),
        formatter.toMarkdown(true)
      );
    }

    await fs.writeFile(
      path.join(this.options.outputDir, "README.md"),
      `# Line Count Results

Generated on: ${new Date().toISOString()}
Target Directory: ${this.targetDir}

This directory contains the following files:

- \`results.json\`: Raw data in JSON format
${this.options.outputAsText ? "- `results.txt`: Human-readable text format\n" : ""}- \`files.csv\`: CSV format with detailed file information
- \`directories.csv\`: CSV format with directory summaries
${this.options.outputAsMarkdown ? "- `results.md`: Summary in markdown format\n- `details.md`: Detailed breakdown by language in markdown format\n" : ""}`
    );
  }

  async run(): Promise<string> {
    console.log(
      colors.info(`Starting line count in: ${colors.highlight(this.targetDir)}`)
    );

    await this.loadLanguageDefinitions();
    const gitignore = await this.loadGitignore();
    const files = await this.findFiles();
    const results = await this.processFiles(files, gitignore);

    const formatter = new ResultFormatter(this.targetDir, results, {
      countDirectLevelFiles: true,
      printCommas: this.options.printCommas,
    });

    let summaryOutput: string;
    switch (this.options.outputFormat) {
      case "json": {
        summaryOutput = formatter.toJson();
        break;
      }
      case "csv": {
        summaryOutput = formatter.toCsv();
        break;
      }
      case "markdown": {
        summaryOutput = formatter.toMarkdown();
        break;
      }
      case "text":
      default: {
        summaryOutput = formatter.toTextLimited();
        break;
      }
    }

    if (this.options.generateResults) {
      await this.generateOutputFiles(results, formatter);
    }

    return summaryOutput;
  }
}
