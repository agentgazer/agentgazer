import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ---------------------------------------------------------------------------
// Mock os.homedir at the module level so it can be overridden per test.
// The actual os module is preserved; only homedir is replaced with a vi.fn().
// ---------------------------------------------------------------------------
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, homedir: vi.fn() };
});

// The mocked homedir is now a vi.fn() that we can configure in beforeEach.
const mockedHomedir = os.homedir as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

/**
 * Dynamically import the config module after resetting the module registry
 * so that the module-level constants (CONFIG_DIR, CONFIG_FILE, DB_FILE)
 * are re-evaluated against the current mocked homedir value.
 */
async function loadConfigModule() {
  return await import("../config.js");
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Create a fresh temp directory for each test
  tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "agentwatch-config-test-"),
  );
  mockedHomedir.mockReturnValue(tmpDir);
  // Reset the module registry so config.ts re-evaluates its constants
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("config", () => {
  // -----------------------------------------------------------------------
  // getConfigDir / getDbPath
  // -----------------------------------------------------------------------
  describe("getConfigDir()", () => {
    it("returns a path under the home directory", async () => {
      const { getConfigDir } = await loadConfigModule();
      expect(getConfigDir()).toBe(path.join(tmpDir, ".agentwatch"));
    });
  });

  describe("getDbPath()", () => {
    it("returns the database file path under the config directory", async () => {
      const { getDbPath } = await loadConfigModule();
      expect(getDbPath()).toBe(
        path.join(tmpDir, ".agentwatch", "data.db"),
      );
    });
  });

  // -----------------------------------------------------------------------
  // readConfig()
  // -----------------------------------------------------------------------
  describe("readConfig()", () => {
    it("returns null when no config file exists", async () => {
      const { readConfig } = await loadConfigModule();
      expect(readConfig()).toBeNull();
    });

    it("returns the config when a valid config file exists", async () => {
      const configDir = path.join(tmpDir, ".agentwatch");
      fs.mkdirSync(configDir, { recursive: true });
      const token =
        "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234";
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ token }),
        "utf-8",
      );

      const { readConfig } = await loadConfigModule();
      const result = readConfig();

      expect(result).not.toBeNull();
      expect(result!.token).toBe(token);
    });

    it("returns null when config file contains invalid JSON", async () => {
      const configDir = path.join(tmpDir, ".agentwatch");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        "NOT-VALID-JSON{{{",
        "utf-8",
      );

      const { readConfig } = await loadConfigModule();
      expect(readConfig()).toBeNull();
    });

    it("returns null when config file has empty token", async () => {
      const configDir = path.join(tmpDir, ".agentwatch");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ token: "" }),
        "utf-8",
      );

      const { readConfig } = await loadConfigModule();
      expect(readConfig()).toBeNull();
    });

    it("returns null when config file has no token field", async () => {
      const configDir = path.join(tmpDir, ".agentwatch");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ other: "value" }),
        "utf-8",
      );

      const { readConfig } = await loadConfigModule();
      expect(readConfig()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // ensureConfig()
  // -----------------------------------------------------------------------
  describe("ensureConfig()", () => {
    it("creates the config directory and file on first run", async () => {
      const { ensureConfig } = await loadConfigModule();

      const configDir = path.join(tmpDir, ".agentwatch");
      const configFile = path.join(configDir, "config.json");

      // Directory and file should not exist yet
      expect(fs.existsSync(configDir)).toBe(false);

      const config = ensureConfig();

      // Directory and file should now exist
      expect(fs.existsSync(configDir)).toBe(true);
      expect(fs.existsSync(configFile)).toBe(true);

      // Config should have a token
      expect(typeof config.token).toBe("string");
      expect(config.token.length).toBeGreaterThan(0);
    });

    it("generates a token that is 64 hex characters (32 bytes)", async () => {
      const { ensureConfig } = await loadConfigModule();
      const config = ensureConfig();

      expect(config.token).toHaveLength(64);
      expect(config.token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns the same config on subsequent calls (idempotent)", async () => {
      const { ensureConfig } = await loadConfigModule();

      const first = ensureConfig();
      const second = ensureConfig();

      expect(first.token).toBe(second.token);
    });

    it("persists the config to disk as valid JSON", async () => {
      const { ensureConfig } = await loadConfigModule();

      const config = ensureConfig();

      const configFile = path.join(tmpDir, ".agentwatch", "config.json");
      const raw = fs.readFileSync(configFile, "utf-8");
      const parsed = JSON.parse(raw);

      expect(parsed.token).toBe(config.token);
    });

    it("returns existing config if directory and file already exist", async () => {
      const configDir = path.join(tmpDir, ".agentwatch");
      fs.mkdirSync(configDir, { recursive: true });

      const existingToken = "a".repeat(64);
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ token: existingToken }, null, 2),
        "utf-8",
      );

      const { ensureConfig } = await loadConfigModule();
      const config = ensureConfig();

      expect(config.token).toBe(existingToken);
    });
  });

  // -----------------------------------------------------------------------
  // resetToken()
  // -----------------------------------------------------------------------
  describe("resetToken()", () => {
    it("generates a new token different from the original", async () => {
      const { ensureConfig, resetToken } = await loadConfigModule();

      const original = ensureConfig();
      const reset = resetToken();

      expect(reset.token).not.toBe(original.token);
    });

    it("generates a token that is 64 hex characters", async () => {
      const { resetToken } = await loadConfigModule();
      const config = resetToken();

      expect(config.token).toHaveLength(64);
      expect(config.token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("overwrites the existing config file on disk", async () => {
      const { ensureConfig, resetToken, readConfig } =
        await loadConfigModule();

      ensureConfig();
      const newConfig = resetToken();
      const persisted = readConfig();

      expect(persisted).not.toBeNull();
      expect(persisted!.token).toBe(newConfig.token);
    });

    it("creates directory if it does not exist", async () => {
      const { resetToken } = await loadConfigModule();

      const configDir = path.join(tmpDir, ".agentwatch");
      expect(fs.existsSync(configDir)).toBe(false);

      const config = resetToken();
      expect(fs.existsSync(configDir)).toBe(true);
      expect(config.token).toHaveLength(64);
    });

    it("produces unique tokens across multiple resets", async () => {
      const { resetToken } = await loadConfigModule();

      const tokens = new Set<string>();
      for (let i = 0; i < 10; i++) {
        tokens.add(resetToken().token);
      }

      // All 10 tokens should be unique (cryptographic randomness)
      expect(tokens.size).toBe(10);
    });
  });
});
