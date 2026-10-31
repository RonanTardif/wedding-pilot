import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{src,tests}/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "tests/architecture/fixtures/**"],
    environment: "node",
  },
});
