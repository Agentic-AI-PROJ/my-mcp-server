import { ChromaClient } from 'chromadb';

const CHROMA_DB_URL = process.env.CHROMA_DB_URL || 'http://localhost:8000';

export class ChromaStore {
    private client: ChromaClient;

    constructor() {
        this.client = new ChromaClient({ path: CHROMA_DB_URL });
    }

    async storeChunks(collectionName: string, chunks: any[]) {
        if (chunks.length === 0) return;

        const collection = await this.client.getOrCreateCollection({
            name: collectionName,
            metadata: { "hnsw:space": "cosine" } // Default to cosine similarity
        });

        const ids = chunks.map(c => `${c.metadata.doc_id}_${c.metadata.chunk_index}`);
        const embeddings = chunks.map(c => c.embedding);
        const metadatas = chunks.map(c => {
            const m: Record<string, string | number | boolean> = {};

            for (const [key, value] of Object.entries(c.metadata)) {
                if (value === null || value === undefined) continue;

                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    m[key] = value;
                } else if (Array.isArray(value)) {
                    // Join arrays (like key_propositions) into strings
                    m[key] = value.join('\n');
                } else if (typeof value === 'object') {
                    // Flatten objects like 'loc' or 'pdf' info into stringified JSON or separate fields if critical.
                    // For now, stringify to be safe.
                    m[key] = JSON.stringify(value);
                }
            }
            return m;
        });
        const documents = chunks.map(c => c.pageContent);

        await collection.add({
            ids,
            embeddings,
            metadatas,
            documents
        });

        // console.log(`Stored ${chunks.length} chunks in ${collectionName}`);
    }

    async query(collectionName: string, queryEmbedding: number[], nResults: number = 5, where?: any) {
        try {
            const collection = await this.client.getCollection({ name: collectionName });
            const results = await collection.query({
                queryEmbeddings: [queryEmbedding], // Chroma expects list of list
                nResults,
                where
            });

            // Flatten results (Chroma returns lists of lists)
            const flattenedResults = [];
            if (results.ids && results.ids.length > 0) {
                for (let i = 0; i < results.ids[0].length; i++) {
                    flattenedResults.push({
                        id: results.ids[0][i],
                        distance: results.distances ? results.distances[0][i] : null,
                        metadata: results.metadatas ? results.metadatas[0][i] : {},
                        content: results.documents ? results.documents[0][i] : null,
                        source: collectionName
                    });
                }
            }
            return flattenedResults;
        } catch (error: any) {
            // If collection doesn't exist, just return empty
            // Chroma throws if collection not found
            // console.warn(`Failed to query collection ${collectionName}: ${error.message}`);
            return [];
        }
    }
}
