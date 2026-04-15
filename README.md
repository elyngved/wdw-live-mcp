# wdw-live-mcp

MCP server to access live WDW wait times and schedules.

## Running locally

```bash
npm install
npm run dev
```

`npm run dev` runs HTTP mode at `http://127.0.0.1:3000/mcp` and prints the URL at startup.
Set `PORT` (and optionally `HOST`) to change the bind address.

## Claude Code setup

This server defaults to stdio transport when run as `node dist/index.js`, which is what Claude Code expects.

1. Build the server:

```bash
npm install
npm run build
```

2. Add it to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "wdw-live": {
      "command": "node",
      "args": ["/your-project-path/wdw-live-mcp/dist/index.js"]
    }
  }
}
```

3. Restart Claude Code and call the `ping` tool.

## Transport modes

- `stdio` (default): for Claude Code / MCP clients that spawn a local process
- `http`: set `MCP_TRANSPORT=http` and run `npm run dev` or `npm run start:http`

## Included tool

- `ping` - returns `pong` (or `pong: <message>` when `message` is provided)
- `get_entity` - returns ThemeParks.wiki entity metadata for a park key
- `get_live_data` - returns live wait times/status/show/dining data for a park key
- `get_schedule` - returns operating hours and ticketed event schedule data for a park key

## ThemeParks UUID quick reference

Accepted park keys for the tools: `magic`, `epcot`, `hollywood`, `animal`, `typhoon`, `blizzard`.
