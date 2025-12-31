import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONFIG } from "../config";
import fs from 'fs';
import path from 'path';
// @ts-ignore
import adb from 'adbkit';

export function registerFireTVTool(server: McpServer) {
    const client = adb.createClient();

    server.tool(
        "fire_tv_click",
        "Simulate a remote control button press on the Fire TV. Use this to navigate menus, control playback, or go home.",
        {
            button: z.enum(["POWER", "HOME", "BACK", "ENTER", "LEFT", "RIGHT", "UP", "DOWN", "MENU", "PLAY_PAUSE"])
                .describe("The remote control button to simulate pressing. Options include navigation keys (UP, DOWN, LEFT, RIGHT), playback controls (PLAY_PAUSE), system keys (HOME, BACK, MENU), and others.")
        },
        async ({ button }) => {
            const host = '192.168.29.87';
            const port = 5555;

            const keycodes: Record<string, number> = {
                "POWER": 224,
                "HOME": 3,
                "BACK": 4,
                "ENTER": 66,
                "LEFT": 21,
                "RIGHT": 22,
                "UP": 19,
                "DOWN": 20,
                "MENU": 82,
                "PLAY_PAUSE": 85
            };

            try {
                await client.connect(host, port);
                const deviceId = `${host}:${port}`;
                await client.shell(deviceId, `input keyevent ${keycodes[button]}`);
                return {
                    content: [{ type: "text", text: `Clicked ${button}` }]
                };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error(`❌ Failed to click ${button}:`, errorMessage);
                return {
                    isError: true,
                    content: [{ type: "text", text: "Failed to click button: " + errorMessage }]
                };
            }
        }
    );

    server.tool(
        "fire_tv_tap",
        "Simulate a touch tap event at specific X and Y coordinates on the Fire TV screen. Useful for interacting with apps that support touch input or when button navigation is insufficient.",
        {
            x: z.number().describe("The horizontal coordinate (pixel value) to tap."),
            y: z.number().describe("The vertical coordinate (pixel value) to tap.")
        },
        async ({ x, y }) => {
            const host = '192.168.29.87';
            const port = 5555;


            try {
                await client.connect(host, port);
                const deviceId = `${host}:${port}`;
                await client.shell(deviceId, `input tap ${x} ${y}`);
                return {
                    content: [{ type: "text", text: `Tapped at (${x}, ${y})` }]
                };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error(`❌ Failed to tap at (${x}, ${y}):`, errorMessage);
                return {
                    isError: true,
                    content: [{ type: "text", text: "Failed to tap: " + errorMessage }]
                };
            }
        }
    );

    server.tool(
        "fire_tv_screenshot",
        "Capture and return a temporary screenshot of the current Fire TV display. Useful for verifying the state of the UI or debugging.",
        {},
        async () => {
            const host = '192.168.29.87';
            const port = 5555;

            try {
                await client.connect(host, port);
                const deviceId = `${host}:${port}`;

                // screencap returns a stream of the PNG
                const stream = await client.screencap(deviceId);

                const buffers: Buffer[] = [];
                for await (const chunk of stream) {
                    buffers.push(chunk);
                }
                const buffer = Buffer.concat(buffers);
                const base64Image = buffer.toString('base64');

                // Save to file
                const screenshotsDir = path.join(__dirname, 'screenshots');
                if (!fs.existsSync(screenshotsDir)) {
                    fs.mkdirSync(screenshotsDir, { recursive: true });
                }
                const filename = `screenshot-${Date.now()}.png`;
                const filepath = path.join(screenshotsDir, filename);
                fs.writeFileSync(filepath, buffer);

                return {
                    content: [
                        { type: "text", text: `Screenshot saved to ${filepath}\nImage URL: file://${filepath}` },
                        {
                            type: "image",
                            data: base64Image,
                            mimeType: "image/png"
                        }
                    ]
                };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error('❌ Failed to capture screenshot:', errorMessage);
                return {
                    isError: true,
                    content: [{ type: "text", text: "Failed to capture screenshot: " + errorMessage }]
                };
            }
        }
    );
}
