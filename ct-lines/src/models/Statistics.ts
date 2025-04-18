import { Count } from '../models/Count';
import { TokenCount } from '../lib/TokenCounter';

export class Statistics extends Count {
    public name: string;
    public files = 0;
    public tokenCount = new TokenCount();

    constructor(name: string) {
        super();
        this.name = name;
    }

    add(value: Count & { tokenCount?: TokenCount }) {
        this.files++;
        if (value.tokenCount) {
            this.tokenCount.add(value.tokenCount);
        }
        return super.add(value);
    }
} 