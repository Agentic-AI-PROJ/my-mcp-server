export function isChunkValid(content: string): boolean {
    if (!content) return false;

    // 1. Check word count (less than 5 words is likely noise)
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount < 5) {
        return false;
    }

    // 2. Regex checks for common footer/header artifacts
    // "Page X of Y"
    const pagePattern = /Page\s+\d+\s+of\s+\d+/i;
    // "Copyright" - usually implies a footer in documentation
    const copyrightPattern = /Copyright/i;
    // "Lorem Ipsum" - placeholder text
    const loremIpsumPattern = /lorem\s+ipsum/i;
    // Repeated separators/punctuation (e.g., ".......", "------", "======")
    const repeatedPunctuationPattern = /^[\W_]+$/;
    // Single URL - often not useful as a standalone chunk
    const singleUrlPattern = /^https?:\/\/[^\s]+$/;


    if (pagePattern.test(content)) {
        return false;
    }

    if (copyrightPattern.test(content)) {
        return false;
    }

    if (loremIpsumPattern.test(content)) {
        return false;
    }

    if (repeatedPunctuationPattern.test(content.trim())) {
        return false;
    }

    if (singleUrlPattern.test(content.trim())) {
        return false;
    }

    return true;
}
