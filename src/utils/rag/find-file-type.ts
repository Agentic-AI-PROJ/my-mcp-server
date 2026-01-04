import path from 'path';
import { fileTypeFromBuffer } from 'file-type';

export enum ChunkingStrategy {
    CODE = "CODE",           // Path C1
    MARKDOWN = "MARKDOWN",   // Path C2
    PROSE = "PROSE",         // Path C3
    LOGS = "LOGS",           // Path C4
    TABLES = "TABLES",       // Path C5
    STRUCTURED = "STRUCTURED" // Fallback for JSON/XML
}

export async function detectStrategy(filePath: string, buffer: Buffer): Promise<{ strategy: ChunkingStrategy, fileType: string }> {
    const ext = path.extname(filePath).toLowerCase();
    const mime = await fileTypeFromBuffer(buffer);

    // 1. Check Binary/MIME Types First
    if (mime?.mime === 'application/pdf') return { strategy: ChunkingStrategy.PROSE, fileType: 'pdf' };

    // Check for Office Documents (Word/PowerPoint)
    const officeMimes = [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
        'application/vnd.ms-powerpoint', // ppt
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
        'application/msword' // doc
    ];
    if (mime?.mime && officeMimes.includes(mime.mime)) {
        return { strategy: ChunkingStrategy.PROSE, fileType: mime.ext };
    }

    // 2. Map Code Extensions (Path C1)
    const codeExts = ['.ts', '.js', '.py', '.go', '.java', '.cpp', '.rs'];
    if (codeExts.includes(ext)) return { strategy: ChunkingStrategy.CODE, fileType: ext };

    // 3. Map Documentation (Path C2)
    if (ext === '.md' || ext === '.mdx') return { strategy: ChunkingStrategy.MARKDOWN, fileType: ext };

    // 4. Map Tables/Logs (Path C4, C5)
    if (ext === '.csv' || ext === '.tsv') return { strategy: ChunkingStrategy.TABLES, fileType: ext };
    if (ext === '.log' || filePath.includes('syslog')) return { strategy: ChunkingStrategy.LOGS, fileType: ext };

    // Explicit fallback for known prose extensions if MIME detection failed
    const proseExts = ['.txt', '.rtf', '.doc', '.docx', '.ppt', '.pptx'];
    if (proseExts.includes(ext)) return { strategy: ChunkingStrategy.PROSE, fileType: ext };

    // 5. Intelligent Fallback for .txt or unknown
    if (isLikelyJSON(buffer)) return { strategy: ChunkingStrategy.STRUCTURED, fileType: 'json' };
    if (isLikelyTable(buffer)) return { strategy: ChunkingStrategy.TABLES, fileType: 'table' };

    return { strategy: ChunkingStrategy.PROSE, fileType: ext }; // Default to paragraph splitting
}

function isLikelyJSON(buf: Buffer) {
    const str = buf.slice(0, 100).toString().trim();
    return str.startsWith('{') || str.startsWith('[');
}

function isLikelyTable(buf: Buffer) {
    const line = buf.slice(0, 500).toString().split('\n')[0];
    return (line.match(/,/g) || []).length > 3 || (line.match(/\t/g) || []).length > 2;
}