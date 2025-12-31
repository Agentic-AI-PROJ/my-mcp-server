
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:3005';
const DEFAULT_MODEL = 'gemini/gemini-2.5-flash-lite';

export function registerAnalyzeImageTool(server: McpServer) {
    server.tool(
        "analyze_image",
        "Analyze an image and return the result. Can answer questions about the image or provide a description.",
        {
            image_path: z.string().describe("URL or local file path (file://...) of the image to analyze"),
            prompt: z.string().optional().describe("Specific question or instruction about the image. Defaults to 'Describe this image in detail.'"),
        },
        async ({ image_path, prompt }) => {
            const userPrompt = prompt || "Describe this image in detail.";

            try {
                // Construct the payload for the LLM service
                const payload = {
                    model_id: DEFAULT_MODEL,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: userPrompt
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: image_path
                                    }
                                }
                            ]
                        }
                    ]
                };

                const response = await fetch(`${LLM_SERVICE_URL}/non-stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Failed to analyze image: ${response.status} ${response.statusText} - ${errorText}`,
                            },
                        ],
                        isError: true,
                    };
                }

                const data: any = await response.json();

                // data.data contains the text response based on llm-chat-service implementation
                const analysisResult = data.data;

                return {
                    content: [
                        {
                            type: "text",
                            text: analysisResult,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error analyzing image: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );
}
