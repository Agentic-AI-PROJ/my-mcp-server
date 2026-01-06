import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { detectStrategy } from "../utils/rag/find-file-type";
import { splitContent } from "../utils/rag/text-splitter";
import { extractTextFromPdf } from "../utils/rag/pdfToText";
import { normalizeText } from "../utils/rag/normalizer";
import { isChunkValid } from "../utils/rag/heuristic-filter";
import { BatchDeduplicator } from "../utils/rag/deduplicator";
import { analyzeChunk } from "../utils/rag/intelligence-hub";
import { Embedder } from "../utils/rag/embedder";
import { ChromaStore } from "../utils/rag/store";
import { extractLLMContext, flattenLLMContext } from "../utils/rag/extract-context";

const DEFAULT_MODEL = 'gemini/gemini-2.0-flash-lite';
const UNSUPPORTED_FILE_TYPES = ['.doc', 'docx', '.ppt', 'pptx', '.rtf'];

export function registerRAGTool(server: McpServer) {
    server.tool(
        "ingest_document",
        "Ingest a document into the knowledge base.",
        {
            document_urls: z.array(z.string()).describe("List of document URLs to ingest."),
            agent_id: z.string().optional().describe("ID of the agent to route to agent_kb"),
            conversation_id: z.string().optional().describe("ID of the conversation to route to conversation_kb")
        },
        async ({ document_urls, agent_id, conversation_id }) => {
            try {
                // Validation
                if (agent_id && conversation_id) {
                    throw new Error("Cannot provide both agent_id and conversation_id");
                }

                const params = {
                    collection_name: "knowledge-base",
                    data: [] as any[]
                };

                const deduplicator = new BatchDeduplicator();

                for (const document_url of document_urls) {
                    const response = await fetch(document_url);
                    if (!response.ok) {
                        console.error(`Failed to fetch ${document_url}: ${response.statusText}`);
                        continue;
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    let content = buffer.toString('utf-8');
                    const { strategy, fileType } = await detectStrategy(document_url, buffer);
                    if (fileType === 'pdf') {
                        content = await extractTextFromPdf(document_url);
                    }
                    if (UNSUPPORTED_FILE_TYPES.includes(fileType)) {
                        console.error(`Unsupported file type: ${fileType}`);
                        params.data.push({
                            url: document_url,
                            fileType,
                            strategy,
                            content,
                            error: `Unsupported file type: ${fileType}`
                        });
                        continue;
                    }
                    const { chunks } = await splitContent(strategy, fileType, content);
                    let normalizedChunks = chunks.map(chunk => ({
                        ...chunk,
                        pageContent: normalizeText(chunk.pageContent)
                    })).filter(chunk => isChunkValid(chunk.pageContent));

                    normalizedChunks = deduplicator.process(normalizedChunks);

                    // Intelligence Hub Integration with Concurrency Control & Post-Processing
                    const analyzedChunks = [];
                    const failedChunks = []; // DLQ
                    const BATCH_SIZE = 5;
                    const embedder = await Embedder.getInstance();

                    for (let i = 0; i < normalizedChunks.length; i += BATCH_SIZE) {
                        const batch = normalizedChunks.slice(i, i + BATCH_SIZE);
                        const results = await Promise.all(batch.map(async (chunk, batchIndex) => {
                            let analysis = await analyzeChunk(chunk.pageContent);
                            let retryCount = 0;
                            const MAX_RETRIES = 3;

                            // Quality Gate & Loop
                            while (analysis && analysis.audit_score < 7 && retryCount < MAX_RETRIES) {
                                retryCount++;
                                analysis = await analyzeChunk(chunk.pageContent, "Audit score too low. Please be more precise and factual.");
                            }

                            if (!analysis || analysis.audit_score < 7) {
                                return {
                                    status: 'failed',
                                    chunk,
                                    error: 'Quality check failed after retries'
                                };
                            }

                            // Metadata & Embeddings
                            // Construct enriched text for better retrieval: Content + Summary + Key Propositions
                            const enrichedText = `
Content: ${chunk.pageContent}
Summary: ${analysis.summary}
Key Propositions:
${analysis.key_propositions.map(p => `- ${p}`).join('\n')}
`.trim();

                            const embedding = await embedder.embedChunk(enrichedText);

                            return {
                                status: 'success',
                                data: {
                                    ...chunk,
                                    metadata: {
                                        ...chunk.metadata,
                                        file_url: document_url,
                                        section_type: analysis.classification,
                                        key_propositions: analysis.key_propositions,
                                        audit_score: analysis.audit_score,
                                        summary: analysis.summary,
                                        doc_id: crypto.randomUUID(),
                                        chunk_index: i + batchIndex,
                                        timestamp: new Date().toISOString()
                                    },
                                    embedding
                                }
                            };
                        }));

                        for (const res of results) {
                            if (res.status === 'success') {
                                analyzedChunks.push(res.data);
                            } else {
                                failedChunks.push(res);
                            }
                        }
                    }

                    params.data.push({
                        url: document_url,
                        fileType,
                        strategy,
                        content,
                        chunks: analyzedChunks,
                        dlq: failedChunks
                    });
                }

                // Routing Logic and Storage
                const chromaStore = new ChromaStore();
                let targetCollection = "general_kb"; // Default
                if (agent_id) {
                    targetCollection = "agent_kb";
                } else if (conversation_id) {
                    targetCollection = "conversation_kb";
                }

                // Gather all successful chunks to store
                let allChunksToStore = [];
                for (const fileData of params.data) {
                    if (fileData.chunks) {
                        allChunksToStore.push(...fileData.chunks);
                    }
                }

                if (allChunksToStore.length > 0) {
                    allChunksToStore = allChunksToStore.map(chunk => ({
                        ...chunk,
                        metadata: {
                            ...chunk.metadata,
                            ...(agent_id ? { agent_id } : {}),
                            ...(conversation_id ? { conversation_id } : {})
                        }
                    }));

                    await chromaStore.storeChunks(targetCollection, allChunksToStore);
                }

                return {
                    content: [{
                        type: "text", text: JSON.stringify({
                            status: "success",
                            target_collection: targetCollection,
                            stored_chunks: allChunksToStore.length,
                            data: params
                        })
                    }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Runtime Error: ${error instanceof Error ? error.message : String(error)}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "retrieve_context",
        "Retrieve relevant context from the knowledge base based on a query.",
        {
            query: z.string().describe("The query to search for."),
            agent_id: z.string().optional().describe("ID of the agent to route to agent_kb"),
            conversation_id: z.string().optional().describe("ID of the conversation to route to conversation_kb"),
            top_k: z.number().optional().describe("Number of results to return. Default is 5.").default(5)
        },
        async ({ query, agent_id, conversation_id, top_k }) => {
            try {
                if (query.trim() === "") {
                    return {
                        content: [{ type: "text", text: "Query cannot be empty." }],
                        isError: true,
                    };
                }
                const k = top_k || 5;
                const normalizedQuery = normalizeText(query);
                const embedder = await Embedder.getInstance();
                const queryEmbedding = await embedder.embedChunk(normalizedQuery);
                const chromaStore = new ChromaStore();

                const resultsPromises = [];

                // 1. General KB (Always)
                resultsPromises.push(chromaStore.query('general_kb', queryEmbedding, k));

                // 2. Agent KB (If agent_id present)
                if (agent_id) {
                    resultsPromises.push(chromaStore.query('agent_kb', queryEmbedding, k, { agent_id: agent_id }));
                }

                // 3. Conversation KB (If conversation_id present)
                if (conversation_id) {
                    resultsPromises.push(chromaStore.query('conversation_kb', queryEmbedding, k, { conversation_id: conversation_id }));
                }

                const allResultsArrays = await Promise.all(resultsPromises);
                const allResults = allResultsArrays.flat();

                // Merge and Global Re-rank
                // Sort by distance (lower is better for cosine distance in Chroma, but verify. 
                // Usually Chroma returns distance. If similarity, higher is better.
                // Default hnsw:space is cosine, which is distance. 0 is identical, 1 is opposite.
                // So sorting by distance ascending is correct.

                // Deduplicate by ID
                const uniqueResultsMap = new Map();
                for (const res of allResults) {
                    const dist = res.distance ?? Infinity;
                    if (!uniqueResultsMap.has(res.id)) {
                        uniqueResultsMap.set(res.id, { ...res, distance: dist });
                    } else {
                        // If duplicate, keep the one with better score (lower distance)
                        const existing = uniqueResultsMap.get(res.id);
                        if (dist < existing.distance) {
                            uniqueResultsMap.set(res.id, { ...res, distance: dist });
                        }
                    }
                }

                const sortedResults = Array.from(uniqueResultsMap.values()).sort((a: any, b: any) => a.distance - b.distance);
                const topK = sortedResults.slice(0, k); // Return top k

                const llmContext = extractLLMContext(topK);
                const flattenedContext = flattenLLMContext(llmContext);

                return {
                    content: [{
                        type: "text",
                        text: flattenedContext
                    }]
                };

            } catch (error) {
                return {
                    content: [{ type: "text", text: `Retrieval Error: ${error instanceof Error ? error.message : String(error)}` }],
                    isError: true,
                };
            }
        }
    );
}