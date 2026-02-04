import * as fs from "node:fs";
import * as path from "node:path";
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
// Passphrase acquisition
// ---------------------------------------------------------------------------

export async function acquirePassphrase(opts?: { confirm?: boolean }): Promise<string> {
  // 1. Environment variable
  const envPassphrase = process.env.AGENTTRACE_PASSPHRASE;
  if (envPassphrase) {
    return envPassphrase;
  }

  // 2. Interactive stdin prompt
  if (process.stdin.isTTY) {
    const passphrase = await promptPassphrase(
      "Enter passphrase to unlock provider keys: "
    );
    if (opts?.confirm) {
      const confirm = await promptPassphrase("Confirm passphrase: ");
      if (passphrase !== confirm) {
        throw new Error("Passphrases do not match.");
      }
    }
    return passphrase;
  }

  // 3. Error
  throw new Error(
    "No passphrase available. Set AGENTTRACE_PASSPHRASE environment variable " +
      "or run in an interactive terminal."
  );
}

function promptPassphrase(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Write prompt to stderr directly
    process.stderr.write(prompt);

    // Read from stdin without echoing
    const stdin = process.stdin;
    const wasPaused = stdin.isPaused();
    const wasRaw = stdin.isRaw;

    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf-8");

    let input = "";

    const onData = (ch: string): void => {
      const c = ch.toString();
      switch (c) {
        case "\n":
        case "\r":
        case "\u0004": // Ctrl+D
          stdin.setRawMode?.(wasRaw);
          stdin.removeListener("data", onData);
          if (wasPaused) stdin.pause();
          process.stderr.write("\n");
          if (!input) {
            reject(new Error("Passphrase cannot be empty."));
          } else {
            resolve(input);
          }
          break;
        case "\u0003": // Ctrl+C
          stdin.setRawMode?.(wasRaw);
          stdin.removeListener("data", onData);
          if (wasPaused) stdin.pause();
          process.stderr.write("\n");
          reject(new Error("Aborted."));
          break;
        case "\u007F": // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
          break;
        default:
          input += c;
          break;
      }
    };

    stdin.on("data", onData);
  });
}

// ---------------------------------------------------------------------------
// EncryptedFileStore
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const FILE_VERSION = 1;

interface EncryptedFileData {
  version: number;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface SecretsData {
  [service: string]: { [account: string]: string };
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

export class EncryptedFileStore implements SecretStore {
  private filePath: string;
  private passphrase: string;
  private cache: SecretsData | null = null;

  constructor(filePath: string, passphrase: string) {
    this.filePath = filePath;
    this.passphrase = passphrase;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async get(service: string, account: string): Promise<string | null> {
    const data = await this.load();
    return data[service]?.[account] ?? null;
  }

  async set(service: string, account: string, value: string): Promise<void> {
    const data = await this.load();
    if (!data[service]) {
      data[service] = {};
    }
    data[service][account] = value;
    await this.save(data);
  }

  async delete(service: string, account: string): Promise<void> {
    const data = await this.load();
    if (data[service]) {
      delete data[service][account];
      if (Object.keys(data[service]).length === 0) {
        delete data[service];
      }
    }
    await this.save(data);
  }

  async list(service: string): Promise<string[]> {
    const data = await this.load();
    return Object.keys(data[service] ?? {});
  }

  private async load(): Promise<SecretsData> {
    if (this.cache) return this.cache;

    if (!fs.existsSync(this.filePath)) {
      this.cache = {};
      return this.cache;
    }

    const raw = fs.readFileSync(this.filePath, "utf-8");
    let fileData: EncryptedFileData;
    try {
      fileData = JSON.parse(raw);
    } catch {
      throw new Error("Corrupted secrets file: invalid JSON.");
    }

    if (fileData.version !== FILE_VERSION) {
      throw new Error(
        `Unsupported secrets file version: ${fileData.version}. Expected ${FILE_VERSION}.`
      );
    }

    const salt = Buffer.from(fileData.salt, "base64");
    const iv = Buffer.from(fileData.iv, "base64");
    const tag = Buffer.from(fileData.tag, "base64");
    const ciphertext = Buffer.from(fileData.ciphertext, "base64");

    const key = deriveKey(this.passphrase, salt);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let plaintext: string;
    try {
      plaintext =
        decipher.update(ciphertext, undefined, "utf-8") +
        decipher.final("utf-8");
    } catch {
      throw new Error(
        "Failed to decrypt secrets. Wrong passphrase or file has been tampered with."
      );
    }

    this.cache = JSON.parse(plaintext) as SecretsData;
    return this.cache;
  }

  private async save(data: SecretsData): Promise<void> {
    this.cache = data;

    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(this.passphrase, salt);

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plaintext = JSON.stringify(data);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf-8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const fileData: EncryptedFileData = {
      version: FILE_VERSION,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: encrypted.toString("base64"),
    };

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(fileData, null, 2), {
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

    execSync(
      `/usr/bin/security add-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)} -w ${shellEscape(value)} -T ""`,
      { stdio: "pipe" }
    );
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
      const result = execSync(
        `/usr/bin/security dump-keychain | grep -A4 "svce.*=.*${shellEscape(service)}"`,
        { stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8" }
      );

      const accounts: string[] = [];
      const acctRegex = /"acct"<blob>="([^"]+)"/g;
      let match;
      while ((match = acctRegex.exec(result)) !== null) {
        accounts.push(match[1]);
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
      execSync("which secret-tool", { stdio: "pipe" });
      return true;
    } catch {
      return false;
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
    execSync(
      `echo -n ${shellEscape(value)} | secret-tool store --label=${shellEscape(`${service}:${account}`)} service ${shellEscape(service)} account ${shellEscape(account)}`,
      { stdio: "pipe" }
    );
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
  const override = process.env.AGENTTRACE_SECRET_BACKEND;
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

  // 4. Encrypted file fallback (requires passphrase acquisition at usage time)
  return createEncryptedFileBackend(configDir);
}

async function createBackend(
  name: string,
  configDir: string
): Promise<{ store: SecretStore; backendName: string }> {
  switch (name) {
    case "keychain":
      return { store: new KeychainStore(), backendName: "keychain" };
    case "libsecret":
      return { store: new LibsecretStore(), backendName: "libsecret" };
    case "encrypted-file":
      return createEncryptedFileBackend(configDir);
    default:
      throw new Error(
        `Unknown secret backend: "${name}". Valid values: keychain, libsecret, encrypted-file`
      );
  }
}

async function createEncryptedFileBackend(
  configDir: string
): Promise<{ store: SecretStore; backendName: string }> {
  const filePath = path.join(configDir, "secrets.enc");
  const isNew = !fs.existsSync(filePath);
  const passphrase = await acquirePassphrase({ confirm: isNew });
  return {
    store: new EncryptedFileStore(filePath, passphrase),
    backendName: "encrypted-file",
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
  const SERVICE = "com.agenttrace.provider";

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    if (providerConfig.apiKey && typeof providerConfig.apiKey === "string") {
      // Write to secret store
      await store.set(SERVICE, name, providerConfig.apiKey);
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

export const PROVIDER_SERVICE = "com.agenttrace.provider";

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
