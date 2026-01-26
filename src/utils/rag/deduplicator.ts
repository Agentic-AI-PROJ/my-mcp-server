import { createHash } from 'crypto';
import { Document } from "@langchain/core/documents";

export class BatchDeduplicator {
    private seenHashes: Set<string>;

    constructor() {
        this.seenHashes = new Set<string>();
    }

    private computeHash(text: string): string {
        return createHash('sha256').update(text).digest('hex');
    }

    public isDuplicate(text: string): boolean {
        const hash = this.computeHash(text);
        if (this.seenHashes.has(hash)) {
            return true;
        }
        this.seenHashes.add(hash);
        return false;
    }

    public process(chunks: Document[]): Document[] {
        return chunks.filter(chunk => !this.isDuplicate(chunk.pageContent));
    }
}
