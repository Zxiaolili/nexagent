import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { serve } from "@hono/node-server";
import { createServer } from "./server/server.js";

// Load .env from cwd, then from monorepo root (so root overrides when using pnpm dev)
config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.join(__dirname, "..", "..", "..", ".env");
config({ path: rootEnv });

const PORT = parseInt(process.env.NEXAGENT_PORT || "3457", 10);
const PROJECTS_ROOT =
  process.env.NEXAGENT_PROJECTS_DIR ||
  path.join(os.homedir(), "nexagent-projects");
const DATA_DIR =
  process.env.NEXAGENT_DATA_DIR ||
  path.join(os.homedir(), ".nexagent", "data");
const SKILLS_DIR =
  process.env.NEXAGENT_SKILLS_DIR ||
  path.join(import.meta.dirname, "..", "..", "skills");

const providerConfig = {
  provider: (process.env.NEXAGENT_PROVIDER || "anthropic") as any,
  model: process.env.NEXAGENT_MODEL || "claude-sonnet-4-20250514",
  apiKey: process.env.NEXAGENT_API_KEY || undefined,
  baseURL: process.env.NEXAGENT_BASE_URL || undefined,
};

const app = createServer({
  projectsRoot: PROJECTS_ROOT,
  dataDir: DATA_DIR,
  skillsDir: SKILLS_DIR,
  provider: providerConfig,
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`
┌──────────────────────────────────────────┐
│                                          │
│   NexAgent Core Server                   │
│   http://localhost:${info.port}               │
│                                          │
│   Projects: ${PROJECTS_ROOT}
│   Provider: ${providerConfig.provider} / ${providerConfig.model}
│                                          │
└──────────────────────────────────────────┘
  `);
});

export { createServer } from "./server/server.js";
export { ProjectManager } from "./project/manager.js";
export { SessionManager } from "./session/index.js";
export { bus } from "./bus/index.js";
