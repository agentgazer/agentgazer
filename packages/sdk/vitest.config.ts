import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    extensions: [".ts", ".js"],
  },
  test: {
    include: ["src/__tests__/**/*.test.ts"],
  },
});
