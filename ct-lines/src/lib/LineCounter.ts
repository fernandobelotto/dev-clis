export class Count {
    public code = 0;
    public comment = 0;
    public blank = 0;

    constructor(init?: { code: number; comment: number; blank: number }) {
        if (init) {
            this.code = init.code;
            this.comment = init.comment;
            this.blank = init.blank;
        }
    }

    get total() {
        return this.code + this.comment + this.blank;
    }

    get isEmpty() {
        return this.total === 0;
    }

    add(other: Count | { code: number; comment: number; blank: number }) {
        if (other instanceof Count) {
            this.code += other.code;
            this.comment += other.comment;
            this.blank += other.blank;
        } else {
            this.code += other.code;
            this.comment += other.comment;
            this.blank += other.blank;
        }
        return this;
    }

    sub(other: Count | { code: number; comment: number; blank: number }) {
        if (other instanceof Count) {
            this.code -= other.code;
            this.comment -= other.comment;
            this.blank -= other.blank;
        } else {
            this.code -= other.code;
            this.comment -= other.comment;
            this.blank -= other.blank;
        }
        return this;
    }
}

const nextIndexOf = (str: string, searchValue: string, fromIndex = 0) => {
    const index = str.indexOf(searchValue, fromIndex);
    return (index >= 0) ? index + searchValue.length : index;
}

const findFirstOf = (str: string, searchStrings: string[], position?: number): [number, number] => {
    let strIndex = Number.MAX_VALUE;
    let arrIndex = -1;
    searchStrings.forEach((s, ai) => {
        const si = str.indexOf(s, position);
        if (si >= 0 && strIndex > si) {
            strIndex = si;
            arrIndex = ai;
        }
    });
    return [strIndex, arrIndex];
}

const rxEspaceRegExpChar = /[.*+?^${}()|[\]\\]/g;

const createStringLiteralRegex = (pairs?: [string, string][]) => {
    if (!pairs || pairs.length <= 0) return undefined;
    const pattern = pairs.map(([start, end]) => {
        const s = start.replace(rxEspaceRegExpChar, '\\$&');
        const e = end.replace(rxEspaceRegExpChar, '\\$&');
        return `${s}(?:\\\\.|[^${e}\\\\])*${e}`;
    }).join('|');
    return new RegExp(pattern, 'g');
}

const LineType = { Code: 0, Comment: 1, Blank: 2 } as const;

export class LineCounter {
    private blockCommentBegins: string[];
    private blockStringBegins: string[];
    private removeStringLiteral: (line: string) => string = (line) => line;

    constructor(
        public readonly name: string,
        private lineComments: string[],
        private blockComments: [string, string][],
        private blockStrings: [string, string][],
        lineStrings?: [string, string][],
    ) {
        this.blockCommentBegins = this.blockComments.map(b => b[0]);
        this.blockStringBegins = this.blockStrings.map(b => b[0]);
        const s = (lineStrings ?? []).filter(p => {
            return blockStrings.every(b => !p[0].startsWith(b[0])) 
                && blockComments.every(b => !p[0].startsWith(b[0]));
        });

        try {
            const pattern = createStringLiteralRegex(s);
            if (pattern) {
                this.removeStringLiteral = (line) => line.replace(pattern, '');
            }
        } catch (e) {
            console.warn(`${name}: ${s.map(v=>v.join('')).join(', ')}`);
        }
    }

    public count(text: string, includeIncompleteLine = false): Count {
        let result = [0, 0, 0];
        let blockCommentEnd = '';
        let blockStringEnd = '';
        const lines = text.split(/\r\n|\r|\n/).map(line => line.trim());
        if (!includeIncompleteLine) {
            lines.pop();
        }

        lines.forEach((line, lineIndex) => {
            let type = (blockCommentEnd.length > 0) ? LineType.Comment : (blockStringEnd.length > 0) ? LineType.Code : LineType.Blank;
            let i = 0;

            while (i < line.length) {
                if (blockCommentEnd.length > 0) {
                    // now in block comment
                    const index = nextIndexOf(line, blockCommentEnd, i);
                    if (index >= 0) {
                        blockCommentEnd = '';
                        i = index;
                    } else {
                        break;
                    }
                } else if (blockStringEnd.length > 0) {
                    // now in block string (here document)
                    const index = nextIndexOf(line, blockStringEnd, i);
                    if (index >= 0) {
                        blockStringEnd = '';
                        i = index;
                    } else {
                        break;
                    }
                } else {
                    if (this.lineComments.some(lc => line.startsWith(lc))) {
                        // now is line comment.
                        type = LineType.Comment;
                        break;
                    }
                    line = this.removeStringLiteral(line);
                    {
                        const [index, bi] = findFirstOf(line, this.blockCommentBegins, i);
                        if (bi >= 0) {
                            // start block comment
                            const range = this.blockComments[bi];
                            type = index === 0 ? LineType.Comment : LineType.Code;
                            blockCommentEnd = range[1];
                            i = index + range[0].length;
                            continue;
                        }
                    }
                    type = LineType.Code;
                    {
                        const [index, bi] = findFirstOf(line, this.blockStringBegins, i);
                        if (bi >= 0) {
                            // start block string
                            const range = this.blockStrings[bi];
                            blockStringEnd = range[1];
                            i = index + range[0].length;
                            continue;
                        }
                    }
                    break;
                }
            }
            result[type]++;
        });

        return new Count({ code: result[LineType.Code], comment: result[LineType.Comment], blank: result[LineType.Blank] });
    }
} 