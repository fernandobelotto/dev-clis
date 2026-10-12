declare module 'enquirer' {
  export class AutoComplete {
    constructor(options: unknown);
    run(): Promise<string | string[]>;
  }
}
