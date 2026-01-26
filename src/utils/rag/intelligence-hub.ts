export interface ChunkAnalysis {
    classification: "Reasoning" | "Fact" | "Boilerplate";
    key_propositions: string[];
    audit_score: number;
    summary: string;
}

const RAG_MODEL = process.env.RAG_MODEL || 'gemini/gemini-2.0-flash-lite';

export async function analyzeChunk(text: string, feedback?: string): Promise<ChunkAnalysis | null> {
    const feedbackPrompt = feedback ? `\n\nPrevious analysis failed quality check. Feedback: ${feedback}\nPlease improve based on this feedback.` : "";

    const prompt = `Analyze this text.
1. Classify (Reasoning/Fact/Boilerplate).
2. Extract key propositions.
3. Audit (Score 1-10 for integrity/quality).
4. Summarize briefly.

Respond strictly in JSON format matching this structure:
{
  "classification": "Reasoning" | "Fact" | "Boilerplate",
  "key_propositions": ["prop1", "prop2"],
  "audit_score": number,
  "summary": "string"
}

Text to analyze:
${text.slice(0, 4000)} // Truncate to avoid context limits if necessary
${feedbackPrompt}
`;

    try {
        const response = await fetch(`${process.env.LLM_SERVICE_URL}/non-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: "user", content: prompt }
                ],
                model_id: RAG_MODEL,
                enable_grounding: false
            })
        });

        if (!response.ok) {
            console.error(`LLM Analysis failed: ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        console.log("LLM Response Keys:", Object.keys(data));
        console.log("LLM Response Data Type:", typeof data);
        if ('data' in data) console.log("data.data length:", (data as any).data?.length);

        // Attempt to find content in common locations (including data.data passed from some proxies)
        const rawContent = data.content || data.response || (data.message && data.message.content) || (data as any).data;

        if (!rawContent) {
            console.error("Unexpected LLM response structure (Full Object):", JSON.stringify(data, null, 2));
            return null;
        }

        // Basic cleanup if the LLM wraps code in markdown blocks
        const jsonString = typeof rawContent === 'string' ? rawContent.replace(/```json\n?|\n?```/g, "").trim() : JSON.stringify(rawContent);


        return JSON.parse(jsonString) as ChunkAnalysis;
    } catch (error) {
        console.error("Error analyzing chunk:", error);
        return null;
    }
}
