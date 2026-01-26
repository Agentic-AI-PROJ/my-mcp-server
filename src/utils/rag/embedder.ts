import { pipeline } from '@xenova/transformers';

export class Embedder {
    private static instance: Embedder;
    private extractor: any;

    private constructor() { }

    public static async getInstance(): Promise<Embedder> {
        if (!Embedder.instance) {
            Embedder.instance = new Embedder();
            Embedder.instance.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }
        return Embedder.instance;
    }

    public async embedChunk(text: string): Promise<number[]> {
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }
}
