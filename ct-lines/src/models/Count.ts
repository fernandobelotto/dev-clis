export class Count {
    public code = 0;
    public comment = 0;
    public blank = 0;
    public total = 0;

    add(value: Count) {
        this.code += value.code;
        this.comment += value.comment;
        this.blank += value.blank;
        this.total += value.total;
        return this;
    }
} 