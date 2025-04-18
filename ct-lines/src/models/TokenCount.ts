export class TokenCount {
    public tokens = 0;

    add(value: TokenCount) {
        this.tokens += value.tokens;
        return this;
    }
} 