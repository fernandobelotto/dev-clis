export class MarkdownTableFormatter<T = string | number> {
    private valueToString: (obj: T) => string;
    private columnInfo: { title: string, format: string }[];

    constructor(valueToString: (obj: T) => string, ...columnInfo: { title: string, format: string }[]) {
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
        return '| ' + data.map((d) => {
            if (typeof d === 'number') {
                return this.valueToString(d as T);
            } else {
                return d;
            }
        }).join(' | ') + ' |';
    }
} 