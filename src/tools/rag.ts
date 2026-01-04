
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { detectStrategy } from "../utils/rag/find-file-type";
import { splitContent } from "../utils/rag/text-splitter";
import { extractTextFromPdf } from "../utils/rag/pdfToText";

const CHROMA_DB_URL = process.env.CHROMA_DB_URL || 'http://localhost:8000';
const DEFAULT_MODEL = 'gemini/gemini-2.5-flash-lite';

export function registerRAGTool(server: McpServer) {
    server.tool(
        "ingest_document",
        "Ingest a document into the knowledge base.",
        {
            document_urls: z.array(z.string()).describe("List of document URLs to ingest."),
        },
        async ({ document_urls }) => {
            try {
                const params = {
                    collection_name: "knowledge-base",
                    data: [] as any[]
                };

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
                    const { chunks } = await splitContent(strategy, fileType, content);

                    params.data.push({
                        url: document_url,
                        fileType,
                        strategy,
                        content,
                        chunks: chunks
                    });
                }
                return {
                    content: [{ type: "text", text: JSON.stringify({ data: params }) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Runtime Error: ${error instanceof Error ? error.message : String(error)}` }],
                    isError: true,
                };
            }
        }
    );
}