# My MCP Server

This is a custom **Model Context Protocol (MCP)** server that exposes specific tools for the AI agent ecosystem. It supports both **SSE** (Server-Sent Events) for remote connections and stdio for local integration.

## 🚀 Features

- **Get Weather**: Fetch weather information for a given location.
- **FireTV Control**: Control FireTV devices (e.g., install apps, launch apps, get device info) via ADB.
- **Analyze Image**: Analyze images using computer vision capabilities.

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express, @modelcontextprotocol/sdk
- **Tools**: ADBKit (for FireTV), Zod (Validation), Dotenv

## 📦 Installation & Setup

1.  **Install dependencies**:
    ```bash
    npm install
    # Note: package-lock.json is git-ignored but can be generated during install
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root of the service:
    ```env
    PORT=3010
    WEATHER_API_KEY=your_weather_api_key
    LLM_SERVICE_URL=LLM_SERVICE_URL
    ```

3.  **Run Server**:
    *   **Development**:
        ```bash
        npm run dev
        ```
    *   **Production**:
        ```bash
        npm start
        ```
    The server works on port `3010` by default.
    SSE Endpoint: `http://localhost:3010/sse`

## 🔌 API Reference

### MCP Protocol
This server implements the MCP protocol. You can connect to it using an MCP Client (like the one in `backend/mcp-client`).

**Connection Details:**
- **Type**: SSE
- **URL**: `http://localhost:3010/sse`

### Tools Exposed
Once connected, the following tools are available to the agent:

- `get_weather`: Get weather forecast.
- `control_firetv`: Send ADB commands to a FireTV device.
- `analyze_image`: Process and analyze an input image.

## 💓 Health Checks

- The server logs "MCP Server running on port 3010" upon successful startup.
- You can test connectivity by opening `http://localhost:3010/sse` in a browser or curl (expecting an SSE stream connection).
