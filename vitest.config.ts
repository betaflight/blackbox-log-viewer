import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Node environment for pose math tests (no DOM needed)
    environment: "node",
    // Include only src/pose tests
    include: ["src/pose/**/*.test.{ts,js}"],
    // 120s timeout for the full acro1 fixture test
    testTimeout: 120_000,
    // Isolate each test file in its own context
    pool: "forks",
  },
});
