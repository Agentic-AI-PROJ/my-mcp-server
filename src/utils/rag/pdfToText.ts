const { PDFParse } = require('pdf-parse');
// import { PDFParse } from 'pdf-parse';

export async function extractTextFromPdf(url: string) {
    const parser = new PDFParse({ url: url });

    const result = await parser.getText();
    return result.text;
}