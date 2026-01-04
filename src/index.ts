import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { CONFIG } from "./config";
import { registerGetWeatherTool } from "./tools/get-weather";
import { registerFireTVTool } from "./tools/firetv";
import { registerAnalyzeImageTool } from "./tools/analyze-image";
import { registerSmartWebSearchTool } from "./tools/smart-web-search";
import { registerRAGTool } from "./tools/rag";

const app = express();
app.use(cors());

const server = new McpServer({
    name: "mcp-server",
    version: "1.0.0",
});

// Register tools
registerGetWeatherTool(server);
registerFireTVTool(server);
registerAnalyzeImageTool(server);
registerSmartWebSearchTool(server);
registerRAGTool(server);

const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
    console.log("New SSE connection");
    const transport = new SSEServerTransport("/sse", res);
    const sessionId = transport.sessionId;

    transports.set(sessionId, transport);

    res.on("close", () => {
        console.log("SSE connection closed", sessionId);
        transports.delete(sessionId);
    });

    await server.connect(transport);
});

app.post("/sse", async (req, res) => {
    console.log("Received message on /sse");
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
        res.status(400).send("Missing sessionId query parameter");
        return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
        res.status(404).send("Session not found");
        return;
    }

    await transport.handlePostMessage(req, res);
});

app.listen(CONFIG.PORT, () => {
    console.log(`MCP Server running on port ${CONFIG.PORT}`);
    console.log(`SSE Endpoint: http://localhost:${CONFIG.PORT}/sse`);
});
