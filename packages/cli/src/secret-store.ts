import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// SecretStore interface
// ---------------------------------------------------------------------------

export interface SecretStore {
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, value: string): Promise<void>;
  delete(service: string, account: string): Promise<void>;
  list(service: string): Promise<string[]>;
  isAvailable(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// MachineKeyStore — AES-256-GCM encrypted file with machine-derived key
// ---------------------------------------------------------------------------

interface SecretsData {
  [service: string]: { [account: string]: string };
}

interface EncryptedEnvelope {
  version: number;
  iv: string;      // hex
  tag: string;     // hex
  ciphertext: string; // hex
}

function getMachineId(): string {
  // macOS: IOPlatformUUID
  if (process.platform === "darwin") {
    try {
      const out = execSync(
        "ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/{print $3}'",
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      );
      const id = out.trim().replace(/"/g, "");
      if (id) return id;
    } catch { /* fall through */ }
  }

  // Linux: /etc/machine-id or /var/lib/dbus/machine-id
  if (process.platform === "linux") {
    for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
      try {
        const id = fs.readFileSync(p, "utf-8").trim();
        if (id) return id;
      } catch { /* continue */ }
    }
  }

  // Fallback: hostname (stable enough for local dev tool)
  return os.hostname();
}

/**
 * Load or generate a random salt for key derivation.
 * The salt is persisted in `~/.agentgazer/config.json` under `_machineKeySalt`.
 */
function loadOrCreateSalt(configDir: string): Buffer {
  const configPath = path.join(configDir, "config.json");

  // Try to read existing salt from config
  try {
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (typeof configData._machineKeySalt === "string" && configData._machineKeySalt.length > 0) {
        return Buffer.from(configData._machineKeySalt, "hex");
      }
    }
  } catch {
    // Config doesn't exist or is invalid — we'll create a new salt
  }

  // Generate a new random salt (32 bytes)
  const salt = crypto.randomBytes(32);

  // Persist to config
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  let configData: Record<string, unknown> = {};
  try {
    if (fs.existsSync(configPath)) {
      configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch { /* start fresh */ }

  configData._machineKeySalt = salt.toString("hex");
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");

  return salt;
}

export class MachineKeyStore implements SecretStore {
  private filePath: string;
  private key: Buffer;
  private cache: SecretsData | null = null;

  /**
   * Derive a key from machine identity using the given salt.
   */
  private static deriveKey(salt: Buffer): Buffer {
    const machineId = getMachineId();
    const username = os.userInfo().username;
    return crypto.scryptSync(
      `${machineId}:${username}`,
      salt,
      32,
      { N: 16384, r: 8, p: 1 },
    );
  }

  constructor(filePath: string) {
    this.filePath = filePath;
    const configDir = path.dirname(filePath);
    const salt = loadOrCreateSalt(configDir);
    this.key = MachineKeyStore.deriveKey(salt);

    // Attempt migration from fixed salt if secrets file exists
    this.migrateFromFixedSalt(configDir);
  }

  /**
   * If the secrets file was encrypted with the old fixed salt, re-encrypt
   * with the new random salt. This is a one-time migration.
   */
  private migrateFromFixedSalt(configDir: string): void {
    if (!fs.existsSync(this.filePath)) return;

    const configPath = path.join(configDir, "config.json");
    let configData: Record<string, unknown> = {};
    try {
      configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch { /* ignore */ }

    // If migration was already done, skip
    if (configData._saltMigrated === true) return;

    // Try decrypting with the current (random) salt key first
    try {
      this.load();
      // If decryption succeeded with the new key, mark migration as done
      configData._saltMigrated = true;
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");
      return;
    } catch {
      // Decryption failed with new key — try the old fixed salt
    }

    const FIXED_SALT = Buffer.from("agentgazer-machine-key-v1");
    const oldKey = MachineKeyStore.deriveKey(FIXED_SALT);

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const envelope = JSON.parse(raw) as EncryptedEnvelope;

      if (!envelope.iv || !envelope.tag || !envelope.ciphertext) return;

      const iv = Buffer.from(envelope.iv, "hex");
      const tag = Buffer.from(envelope.tag, "hex");
      const ciphertext = Buffer.from(envelope.ciphertext, "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", oldKey, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      const data = JSON.parse(decrypted.toString("utf-8")) as SecretsData;

      // Re-encrypt with the new random-salt derived key
      this.cache = data;
      this.save(data);

      // Mark migration as complete
      configData._saltMigrated = true;
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");
    } catch {
      // Neither key works — file may be corrupted or from another machine.
      // Let the normal load() error surface later.
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async get(service: string, account: string): Promise<string | null> {
    const data = this.load();
    return data[service]?.[account] ?? null;
  }

  async set(service: string, account: string, value: string): Promise<void> {
    const data = this.load();
    if (!data[service]) {
      data[service] = {};
    }
    data[service][account] = value;
    this.save(data);
  }

  async delete(service: string, account: string): Promise<void> {
    const data = this.load();
    if (data[service]) {
      delete data[service][account];
      if (Object.keys(data[service]).length === 0) {
        delete data[service];
      }
    }
    this.save(data);
  }

  async list(service: string): Promise<string[]> {
    const data = this.load();
    return Object.keys(data[service] ?? {});
  }

  private load(): SecretsData {
    if (this.cache) return this.cache;

    if (!fs.existsSync(this.filePath)) {
      this.cache = {};
      return this.cache;
    }

    const raw = fs.readFileSync(this.filePath, "utf-8");
    let envelope: EncryptedEnvelope;
    try {
      envelope = JSON.parse(raw) as EncryptedEnvelope;
    } catch {
      throw new Error("Corrupted secrets file: invalid JSON envelope.");
    }

    if (!envelope.iv || !envelope.tag || !envelope.ciphertext) {
      throw new Error("Corrupted secrets file: missing encryption fields.");
    }

    try {
      const iv = Buffer.from(envelope.iv, "hex");
      const tag = Buffer.from(envelope.tag, "hex");
      const ciphertext = Buffer.from(envelope.ciphertext, "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      this.cache = JSON.parse(decrypted.toString("utf-8")) as SecretsData;
    } catch {
      throw new Error(
        "Failed to decrypt secrets file. The machine identity or user may have changed."
      );
    }

    return this.cache;
  }

  private save(data: SecretsData): void {
    this.cache = data;

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(data), "utf-8");
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const envelope: EncryptedEnvelope = {
      version: 1,
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      ciphertext: ciphertext.toString("hex"),
    };

    fs.writeFileSync(this.filePath, JSON.stringify(envelope, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  }
}

// ---------------------------------------------------------------------------
// KeychainStore (macOS)
// ---------------------------------------------------------------------------

export class KeychainStore implements SecretStore {
  async isAvailable(): Promise<boolean> {
    if (process.platform !== "darwin") return false;

    // SSH sessions can't interact with Keychain even if WindowServer is running
    if (process.env.SSH_CLIENT || process.env.SSH_CONNECTION || process.env.SSH_TTY) {
      return false;
    }

    try {
      // Check if WindowServer is running (indicates GUI session)
      execSync("pgrep -x WindowServer", { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  async get(service: string, account: string): Promise<string | null> {
    try {
      const result = execSync(
        `/usr/bin/security find-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)} -w`,
        { stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8" }
      );
      return result.trim();
    } catch {
      return null;
    }
  }

  async set(service: string, account: string, value: string): Promise<void> {
    // Delete existing entry first (add-generic-password fails if it exists)
    try {
      execSync(
        `/usr/bin/security delete-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)}`,
        { stdio: "pipe" }
      );
    } catch {
      // OK if it doesn't exist
    }

    // Use spawnSync with stdin to avoid shell escaping issues with special characters in the password
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync("/usr/bin/security", [
      "add-generic-password",
      "-s", service,
      "-a", account,
      "-w", value,
      "-U"
    ], { stdio: "pipe" });

    if (result.status !== 0) {
      const stderr = result.stderr?.toString() || "Unknown error";
      throw new Error(`Command failed: /usr/bin/security add-generic-password: ${stderr}`);
    }
  }

  async delete(service: string, account: string): Promise<void> {
    try {
      execSync(
        `/usr/bin/security delete-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)}`,
        { stdio: "pipe" }
      );
    } catch {
      // OK if it doesn't exist
    }
  }

  async list(service: string): Promise<string[]> {
    try {
      // Dump keychain and parse for entries matching this service
      const dump = execSync(
        `/usr/bin/security dump-keychain`,
        { stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
      );

      const accounts: string[] = [];
      // Split by entry boundaries and find entries with matching svce
      const entries = dump.split(/keychain:/);
      for (const entry of entries) {
        // Check if this entry has our service
        const svceMatch = entry.match(/"svce"<blob>="([^"]+)"/);
        if (svceMatch && svceMatch[1] === service) {
          const acctMatch = entry.match(/"acct"<blob>="([^"]+)"/);
          if (acctMatch) {
            accounts.push(acctMatch[1]);
          }
        }
      }
      return accounts;
    } catch {
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// LibsecretStore (Linux)
// ---------------------------------------------------------------------------

export class LibsecretStore implements SecretStore {
  async isAvailable(): Promise<boolean> {
    if (process.platform !== "linux") return false;
    try {
      // Actually attempt a lookup — will fail without D-Bus session
      execSync(
        "secret-tool lookup service com.agentgazer.probe 2>/dev/null",
        { stdio: "pipe", timeout: 3000 }
      );
      return true;
    } catch (err: unknown) {
      // Exit code 1 = "not found" (but D-Bus works) → available
      // Other errors (no D-Bus, timeout) → not available
      const exitCode = (err as { status?: number }).status;
      return exitCode === 1;
    }
  }

  async get(service: string, account: string): Promise<string | null> {
    try {
      const result = execSync(
        `secret-tool lookup service ${shellEscape(service)} account ${shellEscape(account)}`,
        { stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8" }
      );
      return result.trim() || null;
    } catch {
      return null;
    }
  }

  async set(service: string, account: string, value: string): Promise<void> {
    try {
      execSync(
        `echo -n ${shellEscape(value)} | secret-tool store --label=${shellEscape(`${service}:${account}`)} service ${shellEscape(service)} account ${shellEscape(account)}`,
        { stdio: "pipe" }
      );
    } catch (err) {
      throw new Error(`Failed to store secret via secret-tool: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async delete(service: string, account: string): Promise<void> {
    try {
      execSync(
        `secret-tool clear service ${shellEscape(service)} account ${shellEscape(account)}`,
        { stdio: "pipe" }
      );
    } catch {
      // OK if it doesn't exist
    }
  }

  async list(service: string): Promise<string[]> {
    try {
      const result = execSync(
        `secret-tool search service ${shellEscape(service)}`,
        { stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8" }
      );

      const accounts: string[] = [];
      const lines = result.split("\n");
      for (const line of lines) {
        const match = line.match(/attribute\.account\s*=\s*(.+)/);
        if (match) {
          accounts.push(match[1].trim());
        }
      }
      return accounts;
    } catch {
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// Backend auto-detection
// ---------------------------------------------------------------------------

export async function detectSecretStore(
  configDir: string
): Promise<{ store: SecretStore; backendName: string }> {
  // 1. Environment variable override
  const override = process.env.AGENTGAZER_SECRET_BACKEND;
  if (override) {
    return createBackend(override, configDir);
  }

  // 2. macOS Keychain (GUI session)
  if (process.platform === "darwin") {
    const keychain = new KeychainStore();
    if (await keychain.isAvailable()) {
      return { store: keychain, backendName: "keychain" };
    }
  }

  // 3. Linux libsecret
  if (process.platform === "linux") {
    const libsecret = new LibsecretStore();
    if (await libsecret.isAvailable()) {
      return { store: libsecret, backendName: "libsecret" };
    }
  }

  // 4. Machine-key encrypted file (SSH, headless, Docker, tty)
  return createMachineKeyBackend(configDir);
}

function createBackend(
  name: string,
  configDir: string
): { store: SecretStore; backendName: string } {
  switch (name) {
    case "keychain":
      return { store: new KeychainStore(), backendName: "keychain" };
    case "libsecret":
      return { store: new LibsecretStore(), backendName: "libsecret" };
    case "machine":
    case "file": // backwards compat alias
      return createMachineKeyBackend(configDir);
    default:
      throw new Error(
        `Unknown secret backend: "${name}". Valid values: keychain, libsecret, machine`
      );
  }
}

function createMachineKeyBackend(
  configDir: string
): { store: SecretStore; backendName: string } {
  const filePath = path.join(configDir, "secrets.enc");
  return {
    store: new MachineKeyStore(filePath),
    backendName: "machine-key",
  };
}

// ---------------------------------------------------------------------------
// Migration from plaintext config
// ---------------------------------------------------------------------------

export async function migrateFromPlaintextConfig(
  configPath: string,
  store: SecretStore
): Promise<number> {
  if (!fs.existsSync(configPath)) return 0;

  let config: { providers?: Record<string, { apiKey?: string; [key: string]: unknown }> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return 0;
  }

  if (!config.providers) return 0;

  let migrated = 0;

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    if (providerConfig.apiKey && typeof providerConfig.apiKey === "string") {
      // Write to secret store
      await store.set(PROVIDER_SERVICE, name, providerConfig.apiKey);
      // Remove from config
      delete providerConfig.apiKey;
      migrated++;
    }
  }

  if (migrated > 0) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  return migrated;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const PROVIDER_SERVICE = "com.agentgazer.provider";
export const OAUTH_SERVICE = "com.agentgazer.oauth";

// ---------------------------------------------------------------------------
// OAuth token storage
// ---------------------------------------------------------------------------

export interface OAuthTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (seconds)
  scope?: string;
  /** Account ID extracted from JWT (for Codex API) */
  accountId?: string;
}

/**
 * Store OAuth token for a provider.
 */
export async function storeOAuthToken(
  store: SecretStore,
  provider: string,
  token: OAuthTokenData
): Promise<void> {
  const value = JSON.stringify(token);
  await store.set(OAUTH_SERVICE, provider, value);
}

/**
 * Get OAuth token for a provider.
 * Returns null if not found or if parsing fails.
 */
export async function getOAuthToken(
  store: SecretStore,
  provider: string
): Promise<OAuthTokenData | null> {
  const value = await store.get(OAUTH_SERVICE, provider);
  if (!value) return null;

  try {
    return JSON.parse(value) as OAuthTokenData;
  } catch {
    return null;
  }
}

/**
 * Remove OAuth token for a provider.
 */
export async function removeOAuthToken(
  store: SecretStore,
  provider: string
): Promise<void> {
  await store.delete(OAUTH_SERVICE, provider);
}

/**
 * List all providers with OAuth tokens stored.
 */
export async function listOAuthProviders(
  store: SecretStore
): Promise<string[]> {
  return store.list(OAUTH_SERVICE);
}

// ---------------------------------------------------------------------------
// Provider key helpers
// ---------------------------------------------------------------------------

export async function loadProviderKeys(
  store: SecretStore
): Promise<Record<string, string>> {
  const accounts = await store.list(PROVIDER_SERVICE);
  const keys: Record<string, string> = {};
  for (const account of accounts) {
    const value = await store.get(PROVIDER_SERVICE, account);
    if (value) {
      keys[account] = value;
    }
  }
  return keys;
}

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}
