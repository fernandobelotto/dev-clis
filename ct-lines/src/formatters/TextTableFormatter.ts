export class TextTableFormatter {
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