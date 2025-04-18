import { padString } from '../utils/StringUtils';

interface Column {
    title: string;
    width: number;
}

export class TextTableFormatter {
    private columns: Column[];
    private valueToString: (obj: number | string) => string;

    constructor(valueToString: (obj: number | string) => string, ...columns: Column[]) {
        this.columns = columns;
        this.valueToString = valueToString;
    }

    private get totalWidth(): number {
        return this.columns.reduce((sum, col) => sum + col.width + 3, -1);
    }

    private get separator(): string {
        return '+' + this.columns.map(col => '-'.repeat(col.width + 2)).join('+') + '+';
    }

    get headerLines(): string[] {
        return [
            this.separator,
            '| ' + this.columns.map(col => padString(col.title, col.width)).join(' | ') + ' |',
            this.separator
        ];
    }

    get footerLines(): string[] {
        return [this.separator];
    }

    line(...values: (string | number)[]): string {
        if (values.length !== this.columns.length) {
            throw new Error(`Expected ${this.columns.length} values but got ${values.length}`);
        }
        return '| ' + values.map((v, i) => padString(this.valueToString(v), this.columns[i].width)).join(' | ') + ' |';
    }
} 