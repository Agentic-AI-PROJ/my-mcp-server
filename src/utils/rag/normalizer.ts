export function normalizeText(text: string): string {
    if (!text) return "";

    // 1. Normalize Unicode (NFC form is standard for web)
    let normalized = text.normalize('NFC');

    // 2. Fix potential encoding artifacts (common replacements)
    // This handles common Windows-1252 to UTF-8 mojibake if encountered, 
    // or just standardizing quotes/dashes.
    normalized = normalized
        .replace(/[\u2018\u2019]/g, "'") // Smart quotes
        .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
        .replace(/\u2013/g, "-")         // En dash
        .replace(/\u2014/g, "--")        // Em dash
        .replace(/\u2026/g, "...");      // Ellipsis

    // 3. Remove non-printable characters (except standard whitespace)
    // normalized = normalized.replace(/[^\x20-\x7E\s]/g, ""); // This might be too aggressive for i18n

    // 4. Collapse multiple spaces into a single space
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}
