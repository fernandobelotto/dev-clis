export default class Gitignore {
  public rules: { pattern: RegExp; included: boolean }[];

  constructor(gitignoreData: string, gitignoreCurrentDir = "") {
    gitignoreCurrentDir = gitignoreCurrentDir
      .replaceAll("\\", "/")
      .replace(/[^/]$/, "$&/");
    this.rules = gitignoreData
      .split(/\r\n|\r|\n/)
      .map((line) => line.trim())
      .filter((line) => line && line[0] !== "#")
      .reverse()
      .reduce<string[][]>(
        (lists, line) => {
          const isNegative = line[0] === "!";
          if (isNegative) {
            line = line.slice(1);
          }
          line = line
            .replace(/^\\#/, "#")
            .replace(/^\\!/, "!")
            .replaceAll("\\ ", " ")
            .replace(/\\$/, " ");
          const slashIndex = line.indexOf("/");
          if (slashIndex === -1 || slashIndex === line.length - 1) {
            line = `${gitignoreCurrentDir}**/${line}`;
          } else if (slashIndex === 0) {
            line = gitignoreCurrentDir + line.slice(1);
          } else {
            line = gitignoreCurrentDir + line;
          }

          if (isNegative === (lists.length % 2 !== 0)) {
            lists.push([]);
          }
          line = line
            .replaceAll(/[{}()+.^$|]/g, "\\$&")
            .replaceAll(/(^|[^\\])\?/g, ".")
            .replaceAll("/**", "([/][^/]+)?")
            .replaceAll("**/", "([^/]+[/])?")
            .replaceAll(/([^\\])\*/g, "$1([^/]?)")
            .replaceAll("?", "*")
            .replace(/[^/]$/, "$&(([/].*)|$)")
            .replace(/\/$/, "(([/].*)|$)");
          (lists.at(-1) as string[]).push(line);
          return lists;
        },
        [[]]
      )
      .map((list, index) => ({
        included: index % 2 === 0,
        pattern: list.length > 0 ? "^((" + list.join(")|(") + "))" : "",
      }))
      .filter((rule) => rule.pattern.length > 0)
      .map((rule) => {
        try {
          return { included: rule.included, pattern: new RegExp(rule.pattern) };
        } catch (error) {
          console.warn(error);
          return;
        }
      })
      .filter((v): v is { pattern: RegExp; included: boolean } => !!v);
  }

  public includes(filepath: string): boolean {
    filepath = filepath.replaceAll("\\", "/");
    const rule = this.rules.find((v) => v.pattern.test(filepath));
    return rule !== undefined && rule.included;
  }

  public excludes(filepath: string): boolean {
    return !this.includes(filepath);
  }

  public merge(...subrules: Gitignore[]): Gitignore {
    const ret = new Gitignore("");
    ret.rules = ret.rules.concat(
      ...subrules.reverse().map((g) => g.rules),
      this.rules
    );
    return ret;
  }

  get debugString(): string {
    return this.rules
      .map(
        (rule) => `${rule.included ? "include" : "exclude"} : ${rule.pattern}`
      )
      .join("\n");
  }
}
