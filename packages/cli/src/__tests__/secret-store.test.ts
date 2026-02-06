import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  MachineKeyStore,
  migrateFromPlaintextConfig,
  PROVIDER_SERVICE,
} from "../secret-store.js";

// ---------------------------------------------------------------------------
// MachineKeyStore tests
// ---------------------------------------------------------------------------

describe("MachineKeyStore", () => {
  let tmpDir: string;
  let secretsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentgazer-test-"));
    secretsPath = path.join(tmpDir, "secrets.enc");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("set and get a secret", async () => {
    const store = new MachineKeyStore(secretsPath);
    await store.set("com.test", "openai", "sk-xxx");
    const value = await store.get("com.test", "openai");
    expect(value).toBe("sk-xxx");
  });

  it("get returns null for non-existent secret", async () => {
    const store = new MachineKeyStore(secretsPath);
    const value = await store.get("com.test", "nonexistent");
    expect(value).toBeNull();
  });

  it("delete removes a secret", async () => {
    const store = new MachineKeyStore(secretsPath);
    await store.set("com.test", "openai", "sk-xxx");
    await store.delete("com.test", "openai");
    const value = await store.get("com.test", "openai");
    expect(value).toBeNull();
  });

  it("list returns account names for a service", async () => {
    const store = new MachineKeyStore(secretsPath);
    await store.set("com.test", "openai", "sk-1");
    await store.set("com.test", "anthropic", "sk-2");
    const accounts = await store.list("com.test");
    expect(accounts.sort()).toEqual(["anthropic", "openai"]);
  });

  it("list returns empty array for unknown service", async () => {
    const store = new MachineKeyStore(secretsPath);
    const accounts = await store.list("com.unknown");
    expect(accounts).toEqual([]);
  });

  it("persists across instances", async () => {
    const store1 = new MachineKeyStore(secretsPath);
    await store1.set("svc", "acct", "secret-value");

    // New instance reads from same file
    const store2 = new MachineKeyStore(secretsPath);
    const value = await store2.get("svc", "acct");
    expect(value).toBe("secret-value");
  });

  it("stores encrypted data, not plaintext", async () => {
    const store = new MachineKeyStore(secretsPath);
    await store.set("svc", "acct", "my-secret");
    const raw = fs.readFileSync(secretsPath, "utf-8");
    expect(raw).not.toContain("my-secret");
    // But should be valid JSON envelope
    const envelope = JSON.parse(raw);
    expect(envelope.version).toBe(1);
    expect(envelope.ciphertext).toBeDefined();
    expect(envelope.iv).toBeDefined();
    expect(envelope.tag).toBeDefined();
  });

  it("creates file with 0600 permissions on Unix", async () => {
    const store = new MachineKeyStore(secretsPath);
    await store.set("svc", "acct", "val");

    const stat = fs.statSync(secretsPath);
    // 0o600 = owner read+write, no group/other
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("isAvailable always returns true", async () => {
    const store = new MachineKeyStore(secretsPath);
    expect(await store.isAvailable()).toBe(true);
  });

  it("handles multiple services in same file", async () => {
    const store = new MachineKeyStore(secretsPath);
    await store.set("svc-a", "key1", "val-a1");
    await store.set("svc-b", "key1", "val-b1");

    expect(await store.get("svc-a", "key1")).toBe("val-a1");
    expect(await store.get("svc-b", "key1")).toBe("val-b1");
  });

  it("throws on corrupted file", async () => {
    fs.writeFileSync(secretsPath, "not json {{{");
    const store = new MachineKeyStore(secretsPath);
    await expect(store.get("svc", "acct")).rejects.toThrow(/invalid JSON/);
  });

  it("creates parent directory if it does not exist", async () => {
    const nestedPath = path.join(tmpDir, "sub", "dir", "secrets.enc");
    const store = new MachineKeyStore(nestedPath);
    await store.set("svc", "acct", "val");

    expect(fs.existsSync(nestedPath)).toBe(true);
    expect(await store.get("svc", "acct")).toBe("val");
  });
});

// ---------------------------------------------------------------------------
// Migration tests
// ---------------------------------------------------------------------------

describe("migrateFromPlaintextConfig", () => {
  let tmpDir: string;
  let configPath: string;
  let secretsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentgazer-migrate-"));
    configPath = path.join(tmpDir, "config.json");
    secretsPath = path.join(tmpDir, "secrets.enc");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("migrates plaintext keys to secret store", async () => {
    const config = {
      token: "abc123",
      providers: {
        openai: { apiKey: "sk-test-key", rateLimit: { maxRequests: 10, windowSeconds: 60 } },
        anthropic: { apiKey: "sk-ant-key" },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(config));

    const store = new MachineKeyStore(secretsPath);
    const count = await migrateFromPlaintextConfig(configPath, store);

    expect(count).toBe(2);
    expect(await store.get(PROVIDER_SERVICE, "openai")).toBe("sk-test-key");
    expect(await store.get(PROVIDER_SERVICE, "anthropic")).toBe("sk-ant-key");

    // Config should have apiKey removed but rateLimit preserved
    const updatedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(updatedConfig.providers.openai.apiKey).toBeUndefined();
    expect(updatedConfig.providers.openai.rateLimit).toEqual({
      maxRequests: 10,
      windowSeconds: 60,
    });
    expect(updatedConfig.providers.anthropic.apiKey).toBeUndefined();
  });

  it("returns 0 when no plaintext keys exist", async () => {
    const config = {
      token: "abc123",
      providers: {
        openai: { rateLimit: { maxRequests: 10, windowSeconds: 60 } },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(config));

    const store = new MachineKeyStore(secretsPath);
    const count = await migrateFromPlaintextConfig(configPath, store);
    expect(count).toBe(0);
  });

  it("returns 0 when config has no providers", async () => {
    const config = { token: "abc123" };
    fs.writeFileSync(configPath, JSON.stringify(config));

    const store = new MachineKeyStore(secretsPath);
    const count = await migrateFromPlaintextConfig(configPath, store);
    expect(count).toBe(0);
  });

  it("returns 0 when config file does not exist", async () => {
    const store = new MachineKeyStore(secretsPath);
    const count = await migrateFromPlaintextConfig(
      path.join(tmpDir, "nonexistent.json"),
      store
    );
    expect(count).toBe(0);
  });

  it("is idempotent — re-running after migration does nothing", async () => {
    const config = {
      token: "abc123",
      providers: { openai: { apiKey: "sk-test" } },
    };
    fs.writeFileSync(configPath, JSON.stringify(config));

    const store = new MachineKeyStore(secretsPath);

    // First migration
    const count1 = await migrateFromPlaintextConfig(configPath, store);
    expect(count1).toBe(1);

    // Second migration — apiKey already removed from config
    const count2 = await migrateFromPlaintextConfig(configPath, store);
    expect(count2).toBe(0);

    // Key still in store
    expect(await store.get(PROVIDER_SERVICE, "openai")).toBe("sk-test");
  });
});
