type RetrievalResult = {
    content?: string;
    metadata?: {
        key_propositions?: string;
        summary?: string;
        [key: string]: any;
    };
    [key: string]: any;
};

type LLMChunk = {
    content?: string;
    key_propositions?: string;
    summary?: string;
};

export function extractLLMContext(retrievalResults: RetrievalResult[]): LLMChunk[] {
    const llmChunks: LLMChunk[] = [];

    for (const r of retrievalResults) {
        const chunk: LLMChunk = {};

        // Keep only semantically useful fields
        if (r.content) {
            chunk.content = r.content;
        }

        const meta = r.metadata ?? {};

        if (meta.key_propositions) {
            chunk.key_propositions = meta.key_propositions;
        }

        if (meta.summary) {
            chunk.summary = meta.summary;
        }

        if (Object.keys(chunk).length > 0) {
            llmChunks.push(chunk);
        }
    }

    return llmChunks;
}

export function flattenLLMContext(chunks: LLMChunk[]): string {
    const parts: string[] = [];

    for (const c of chunks) {
        parts.push(`# Chunk Index: ${chunks.indexOf(c) + 1}`);
        if (c.summary) {
            parts.push(`### Summary:\n${c.summary}`);
        }

        if (c.key_propositions) {
            parts.push(`### Key facts:\n${c.key_propositions}`);
        }

        if (c.content) {
            parts.push(`### Source:\n${c.content}`);
        }

        parts.push(`---`);

    }

    return parts.join("\n\n");
}
