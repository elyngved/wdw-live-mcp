#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { z } from "zod";

const server = new McpServer({
  name: "wdw-live-mcp",
  version: "0.1.0",
});

server.registerTool(
  "ping",
  {
    description: "Return a pong response for connectivity checks.",
    inputSchema: {
      message: z.string().optional().describe("Optional message to echo back."),
    },
  },
  async ({ message }) => {
    const text = message ? `pong: ${message}` : "pong";

    return {
      content: [{ type: "text", text }],
    };
  },
);

const transportMode = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();
const DEFAULT_PORT = 3000;

function resolvePort(rawPort: string | undefined): number {
  const candidate = rawPort?.trim();

  if (!candidate) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(candidate, 10);
  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
    return DEFAULT_PORT;
  }

  return parsedPort;
}

if (transportMode === "http") {
  const port = resolvePort(process.env.PORT);
  const host = process.env.HOST ?? "127.0.0.1";

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  const httpServer = createServer((req, res) => {
    if (!req.url?.startsWith("/mcp")) {
      res.writeHead(404).end("Not found");
      return;
    }

    void transport.handleRequest(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.writeHead(500).end(message);
    });
  });

  httpServer.on("error", (error: NodeJS.ErrnoException) => {
    const code = error.code ?? "UNKNOWN";
    const message = error.message;
    console.error(
      `Failed to start MCP HTTP server on ${host}:${port} (${code}): ${message}`,
    );
    process.exitCode = 1;
  });

  httpServer.listen(port, host, () => {
    console.log(`MCP server listening on http://${host}:${port}/mcp`);
  });
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
