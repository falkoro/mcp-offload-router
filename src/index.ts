import { appendFileSync } from "node:fs";
import { loadConfig } from "./config.js";
import { UsageTracker, type UsageTrackerOptions } from "./tracker.js";
import { createMiniMaxAdapter, createSyntheticNewAdapter } from "./providers.js";
import { createRouter } from "./router.js";
import { startStdioServer } from "./server.js";

async function main() {
  const config = loadConfig();

  const trackerOptions: UsageTrackerOptions = {};
  if (config.persistUsage) {
    trackerOptions.onUsage = (provider, tokensUsed, timestamp) => {
      const line = JSON.stringify({ provider, tokensUsed, timestamp }) + "\n";
      appendFileSync("usage.jsonl", line);
    };
  }

  const tracker = new UsageTracker(
    {
      minimax: config.minimax,
      syntheticnew: config.syntheticnew,
    },
    trackerOptions
  );

  const adapters = [
    createMiniMaxAdapter(config.minimax),
    createSyntheticNewAdapter(config.syntheticnew),
  ];

  const router = createRouter(adapters, tracker);

  if (config.transport === "stdio") {
    const close = await startStdioServer(config.defaultProvider, router);

    const shutdown = async () => {
      console.error("Shutting down...");
      await close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } else {
    throw new Error("SSE transport is not implemented in v1");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
