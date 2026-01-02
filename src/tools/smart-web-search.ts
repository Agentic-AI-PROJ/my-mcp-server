
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:3005';
const DEFAULT_MODEL = 'gemini/gemini-2.5-flash-lite';

export function registerSmartWebSearchTool(server: McpServer) {
    server.tool(
        "smart_web_search",
        "A premium research tool for REAL-TIME data. returns definitive answers, not placeholders. " +
        "USE ONLY for: 1) Explicit search requests, 2) Data post-2024 (stocks/news), 3) Fact-checking. " +
        "BATCHING: Provide all related sub-queries in the 'queries' array to consolidate costs." +
        "It is an LLM that can search the web to get real-time data.",
        {
            queries: z.array(z.string()).describe("List of specific search strings or questions to research."),
        },
        async ({ queries }) => {
            try {
                const systemContext = `You are a grounded researcher. ` +
                    `Do NOT use placeholders like '[Insert Date]'. Fetch ACTUAL current values from the web.`;
                const combinedPrompt = queries.length > 1
                    ? `${systemContext}\n\nResearch these specific topics and provide a consolidated factual report:\n${queries.map(q => `- ${q}`).join('\n')}`
                    : `${systemContext}\n\nQuery: ${queries[0]}`;
                const payload = {
                    model_id: DEFAULT_MODEL,
                    messages: [
                        {
                            role: "user",
                            content: combinedPrompt,
                            // Ensure your back-end service maps this to { "google_search": {} } in the actual Gemini API call
                        }
                    ],
                    enable_grounding: true
                };

                const response = await fetch(`${LLM_SERVICE_URL}/non-stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return {
                        content: [{ type: "text", text: `Search Error: ${response.status} - ${errorText}` }],
                        isError: true,
                    };
                }

                const data: any = await response.json();
                return {
                    content: [{ type: "text", text: data.data }],
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