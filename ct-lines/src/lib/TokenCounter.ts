import { type Tiktoken, type TiktokenEncoding, get_encoding } from 'tiktoken';

export class TokenCounter {
    private encoding: Tiktoken;

    constructor(encodingName: TiktokenEncoding = 'cl100k_base') {
        this.encoding = get_encoding(encodingName);
    }

    public countTokens(content: string, filePath?: string): number {
        try {
            return this.encoding.encode(content).length;
        } catch (error) {
            let message = '';
            if (error instanceof Error) {
                message = error.message;
            } else {
                message = String(error);
            }

            if (filePath) {
                console.warn(`Failed to count tokens. path: ${filePath}, error: ${message}`);
            } else {
                console.warn(`Failed to count tokens. error: ${message}`);
            }

            return 0;
        }
    }

    public free(): void {
        this.encoding.free();
    }
}

export class TokenCount {
    constructor(
        public tokens: number = 0,
    ) {}

    add(value: TokenCount) {
        this.tokens += value.tokens;
        return this;
    }

    sub(value: TokenCount) {
        this.tokens -= value.tokens;
        return this;
    }
} 