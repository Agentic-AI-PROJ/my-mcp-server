import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONFIG } from "../config";

export function registerGetWeatherTool(server: McpServer) {
    server.tool(
        "get_weather",
        "Get current weather for a specified city",
        {
            city: z.string().describe("City name to fetch weather for"),
        },
        async ({ city }) => {
            try {
                const response = await fetch(
                    `http://api.weatherapi.com/v1/current.json?key=${CONFIG.WEATHER_API_KEY}&q=${encodeURIComponent(
                        city
                    )}`
                );

                if (!response.ok) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Failed to fetch weather data for ${city}: ${response.statusText}`,
                            },
                        ],
                        isError: true,
                    };
                }

                const data = await response.json();

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error fetching weather data: ${error instanceof Error ? error.message : String(error)
                                }`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );
}
