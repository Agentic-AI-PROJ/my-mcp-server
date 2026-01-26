import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter, MarkdownTextSplitter } from "@langchain/textsplitters";
import { ChunkingStrategy } from "./find-file-type";

// C1: Code Splitter (Logic for Functions/Classes)
const splitCode = async (fileType: string, content: string) => {
    const fileTypeMap: Record<string, string> = {
        '.py': 'python',
        '.js': 'js',
        '.ts': 'js',
        '.go': 'go',
        '.java': 'java',
        '.cpp': 'cpp',
        '.rs': 'rust',
    };
    const splitter = RecursiveCharacterTextSplitter.fromLanguage(fileTypeMap[fileType] as any, {
        chunkSize: 1000,
        chunkOverlap: 100,
    });
    const docs = await splitter.createDocuments([content]);
    return { chunks: docs };
};

// C2: Markdown Splitter (Logic for Headings)
const splitMarkdown = async (content: string) => {
    const splitter = new MarkdownTextSplitter({
        chunkSize: 800,
        chunkOverlap: 50,
    });
    const docs = await splitter.createDocuments([content]);
    return { chunks: docs };
};

// C3: Prose/PDF Splitter (Paragraphs)
const splitProse = async (content: string) => {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2500,
        chunkOverlap: 100,
        separators: ["\n\n", "\n", ". ", "? ", "! "],
    });
    const docs = await splitter.createDocuments([content]);
    return { chunks: docs };
};

// C4: Logs Splitter (Lines)
const splitLogs = async (content: string) => {
    const lines = content.split("\n")
        .filter(line => line.trim().length > 0)
        .map(line => new Document({ pageContent: line }));
    return { chunks: lines };
};

// C5: Tables Splitter (Rows)
const splitTables = async (content: string) => {
    // Logic to treat each row as a document, often prepending headers
    const rows = content.split("\n");
    const header = rows[0];
    const chunkDocs = rows.slice(1).map(row =>
        new Document({ pageContent: `Header: ${header} | Data: ${row}` })
    );
    return { chunks: chunkDocs };
};

export async function splitContent(strategy: ChunkingStrategy, fileType: string, content: string) {
    switch (strategy) {
        case ChunkingStrategy.CODE:
            return await splitCode(fileType, content);
        case ChunkingStrategy.MARKDOWN:
            return await splitMarkdown(content);
        case ChunkingStrategy.PROSE:
            return await splitProse(content);
        case ChunkingStrategy.LOGS:
            return await splitLogs(content);
        case ChunkingStrategy.TABLES:
            return await splitTables(content);
        case ChunkingStrategy.STRUCTURED:
            // Reuse JSON logic or similar
            return { chunks: [new Document({ pageContent: content })] };
        default:
            return await splitProse(content);
    }
}