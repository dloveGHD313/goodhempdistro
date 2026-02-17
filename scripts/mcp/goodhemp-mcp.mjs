import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
ListToolsRequestSchema,
CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const execFileAsync = promisify(execFile);

const REPO_ROOT = process.cwd();

function safeResolve(p) {
const full = path.resolve(REPO_ROOT, p);
if (!full.startsWith(REPO_ROOT)) throw new Error("Path escapes repo root");
return full;
}

const server = new Server(
{ name: "goodhemp-local", version: "0.1.0" },
{ capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
return {
tools: [
{
name: "fs_list",
description: "List files/folders under a repo-relative directory",
inputSchema: {
type: "object",
properties: { dir: { type: "string" } },
required: ["dir"]
}
},
{
name: "fs_read",
description: "Read a text file (repo-relative path)",
inputSchema: {
type: "object",
properties: { file: { type: "string" } },
required: ["file"]
}
},
{
name: "fs_search",
description: "Search text in repo (simple grep-like search)",
inputSchema: {
type: "object",
properties: {
query: { type: "string" },
dir: { type: "string", default: "." }
},
required: ["query"]
}
},
{
name: "git_status",
description: "Run `git status -sb`",
inputSchema: { type: "object", properties: {} }
},
{
name: "npm_run",
description: "Run an npm script safely (example: build, dev, test)",
inputSchema: {
type: "object",
properties: { script: { type: "string" } },
required: ["script"]
}
}
]
};
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
const { name, arguments: args } = req.params;

if (name === "fs_list") {
const dir = safeResolve(args.dir);
const entries = await fs.readdir(dir, { withFileTypes: true });
const out = entries.map(e => ({
name: e.name,
type: e.isDirectory() ? "dir" : "file"
}));
return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}

if (name === "fs_read") {
const file = safeResolve(args.file);
const text = await fs.readFile(file, "utf8");
return { content: [{ type: "text", text }] };
}

if (name === "fs_search") {
const query = String(args.query);
const baseDir = safeResolve(args.dir ?? ".");
// Lightweight search: scan .ts/.tsx/.js/.mjs/.md/.css/.json
const exts = new Set([".ts",".tsx",".js",".jsx",".mjs",".md",".css",".json"]);
const results = [];

async function walk(d) {
const entries = await fs.readdir(d, { withFileTypes: true });
for (const e of entries) {
if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
const full = path.join(d, e.name);
if (e.isDirectory()) await walk(full);
else if (exts.has(path.extname(e.name))) {
const txt = await fs.readFile(full, "utf8").catch(() => "");
if (txt.includes(query)) {
results.push(path.relative(REPO_ROOT, full));
}
}
}
}

await walk(baseDir);
return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
}

if (name === "git_status") {
const { stdout } = await execFileAsync("git", ["status", "-sb"], { cwd: REPO_ROOT });
return { content: [{ type: "text", text: stdout }] };
}

if (name === "npm_run") {
const script = String(args.script);
const { stdout, stderr } = await execFileAsync("npm", ["run", script], { cwd: REPO_ROOT });
return { content: [{ type: "text", text: stdout + (stderr ? "\n" + stderr : "") }] };
}

throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
