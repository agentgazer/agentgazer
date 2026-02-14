/**
 * Security patterns for detecting prompt injection, sensitive data, and tool restrictions.
 */

// ---------------------------------------------------------------------------
// Prompt Injection Detection Patterns
// ---------------------------------------------------------------------------

export interface PromptInjectionPattern {
  name: string;
  category: "ignore_instructions" | "system_override" | "role_hijacking" | "jailbreak";
  pattern: RegExp;
  severity: "warning" | "critical";
}

export const PROMPT_INJECTION_PATTERNS: PromptInjectionPattern[] = [
  // Ignore Instructions
  {
    name: "ignore_previous",
    category: "ignore_instructions",
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    severity: "critical",
  },
  {
    name: "forget_instructions",
    category: "ignore_instructions",
    pattern: /forget\s+(all\s+)?(your\s+)?(instructions?|rules?|training|programming)/i,
    severity: "critical",
  },
  {
    name: "disregard_context",
    category: "ignore_instructions",
    pattern: /disregard\s+(all\s+)?(previous|prior|system|context)/i,
    severity: "critical",
  },
  {
    name: "do_not_follow",
    category: "ignore_instructions",
    pattern: /do\s+not\s+follow\s+(your\s+)?(original|previous|system)\s+(instructions?|rules?)/i,
    severity: "critical",
  },

  // System Override
  {
    name: "new_system_prompt",
    category: "system_override",
    pattern: /new\s+system\s+prompt|override\s+system\s+(prompt|message)|replace\s+system\s+instructions?/i,
    severity: "critical",
  },
  {
    name: "system_colon",
    category: "system_override",
    pattern: /^system\s*:/im,
    severity: "warning",
  },
  {
    name: "developer_mode",
    category: "system_override",
    pattern: /enable\s+developer\s+mode|activate\s+debug\s+mode|enter\s+(admin|root)\s+mode/i,
    severity: "critical",
  },
  {
    name: "sudo_please",
    category: "system_override",
    pattern: /sudo\s+mode|admin\s+access|root\s+privileges/i,
    severity: "warning",
  },

  // Role Hijacking
  {
    name: "you_are_now",
    category: "role_hijacking",
    pattern: /you\s+are\s+now\s+(a|an|the|acting\s+as)/i,
    severity: "critical",
  },
  {
    name: "pretend_to_be",
    category: "role_hijacking",
    pattern: /pretend\s+(to\s+be|you\s+are)|act\s+as\s+if\s+you\s+(are|were)/i,
    severity: "critical",
  },
  {
    name: "roleplay_as",
    category: "role_hijacking",
    pattern: /roleplay\s+as|play\s+the\s+role\s+of|simulate\s+being/i,
    severity: "warning",
  },
  {
    name: "assume_identity",
    category: "role_hijacking",
    pattern: /assume\s+the\s+(identity|role|persona)\s+of/i,
    severity: "critical",
  },

  // Jailbreak
  {
    name: "dan_jailbreak",
    category: "jailbreak",
    pattern: /\bDAN\b.*do\s+anything\s+now|\bdo\s+anything\s+now\b.*\bDAN\b/i,
    severity: "critical",
  },
  {
    name: "jailbreak_keyword",
    category: "jailbreak",
    pattern: /jailbreak|bypass\s+(safety|restrictions?|filters?)|remove\s+(restrictions?|limitations?|safeguards?)/i,
    severity: "critical",
  },
  {
    name: "no_restrictions",
    category: "jailbreak",
    pattern: /without\s+(any\s+)?(restrictions?|limitations?|filters?|safeguards?)/i,
    severity: "warning",
  },
  {
    name: "disable_safety",
    category: "jailbreak",
    pattern: /disable\s+(safety|content)\s+(filters?|checks?)|turn\s+off\s+(safety|moderation)/i,
    severity: "critical",
  },

  // ---------------------------------------------------------------------------
  // Chinese (中文) Patterns
  // ---------------------------------------------------------------------------

  // Ignore Instructions (忽略指令)
  {
    name: "ignore_previous_zh",
    category: "ignore_instructions",
    pattern: /(忽略|無視|忘記|不要理會|跳過).{0,10}(之前|先前|以上|前面|原本|原來).{0,10}(指令|規則|指示|提示|設定)/,
    severity: "critical",
  },
  {
    name: "forget_rules_zh",
    category: "ignore_instructions",
    pattern: /(忘記|忘掉|拋棄|丟掉).{0,10}(你的|原本的|系統的).{0,10}(規則|指令|設定|限制)/,
    severity: "critical",
  },
  {
    name: "do_not_follow_zh",
    category: "ignore_instructions",
    pattern: /(不要|不用|不必|別).{0,5}(遵守|遵循|聽從|按照).{0,10}(指令|規則|指示)/,
    severity: "critical",
  },

  // System Override (系統覆蓋)
  {
    name: "new_system_prompt_zh",
    category: "system_override",
    pattern: /(新的|替換|覆蓋|更改|修改).{0,10}(系統|system).{0,5}(提示|指令|設定|prompt)/,
    severity: "critical",
  },
  {
    name: "developer_mode_zh",
    category: "system_override",
    pattern: /(開啟|啟用|進入|切換到).{0,10}(開發者|開發人員|管理員|root|admin|debug).{0,5}(模式|權限)/,
    severity: "critical",
  },
  {
    name: "system_colon_zh",
    category: "system_override",
    pattern: /^(系統|System)\s*[:：]/im,
    severity: "warning",
  },

  // Role Hijacking (角色劫持)
  {
    name: "you_are_now_zh",
    category: "role_hijacking",
    pattern: /(你現在是|從現在起你是|你的身份是|你要扮演|你要假裝是)/,
    severity: "critical",
  },
  {
    name: "pretend_to_be_zh",
    category: "role_hijacking",
    pattern: /(假裝|假設|模擬|扮演|裝作).{0,5}(你是|自己是|成為)/,
    severity: "critical",
  },
  {
    name: "roleplay_zh",
    category: "role_hijacking",
    pattern: /(角色扮演|roleplay|cosplay).{0,10}(成為|作為|扮演)/,
    severity: "warning",
  },
  {
    name: "identity_change_zh",
    category: "role_hijacking",
    pattern: /(改變|切換|轉換).{0,5}(你的|自己的).{0,5}(身份|角色|人格|人設)/,
    severity: "critical",
  },

  // Jailbreak (越獄)
  {
    name: "jailbreak_zh",
    category: "jailbreak",
    pattern: /(越獄|破解|解鎖|突破).{0,10}(限制|封鎖|安全|保護)/,
    severity: "critical",
  },
  {
    name: "no_restrictions_zh",
    category: "jailbreak",
    pattern: /(沒有|不受|移除|去除|取消).{0,10}(限制|約束|規則|束縛|安全)/,
    severity: "critical",
  },
  {
    name: "bypass_safety_zh",
    category: "jailbreak",
    pattern: /(繞過|跳過|忽略|關閉|停用).{0,10}(安全|內容|審查|過濾).{0,5}(機制|檢查|系統|功能)/,
    severity: "critical",
  },
  {
    name: "unrestricted_zh",
    category: "jailbreak",
    pattern: /(無限制|不設限|完全自由|任意回答|什麼都可以)/,
    severity: "warning",
  },
];

// ---------------------------------------------------------------------------
// Sensitive Data Patterns
// ---------------------------------------------------------------------------

export interface SensitiveDataPattern {
  name: string;
  category: "api_keys" | "credit_cards" | "personal_data" | "crypto" | "env_vars" | "hardware_fingerprint";
  pattern: RegExp;
  replacement?: string;  // Custom replacement text
}

export const SENSITIVE_DATA_PATTERNS: SensitiveDataPattern[] = [
  // API Keys
  {
    name: "openai_key",
    category: "api_keys",
    pattern: /sk-[A-Za-z0-9]{32,}/g,
  },
  {
    name: "anthropic_key",
    category: "api_keys",
    pattern: /sk-ant-[A-Za-z0-9\-]{32,}/g,
  },
  {
    name: "google_key",
    category: "api_keys",
    pattern: /AIza[A-Za-z0-9\-_]{35}/g,
  },
  {
    name: "aws_key",
    category: "api_keys",
    pattern: /AKIA[A-Z0-9]{16}/g,
  },
  {
    name: "aws_secret",
    category: "api_keys",
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?([A-Za-z0-9+/]{40})['"]?/g,
  },
  {
    name: "github_token",
    category: "api_keys",
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  },
  {
    name: "stripe_key",
    category: "api_keys",
    pattern: /sk_(live|test)_[A-Za-z0-9]{24,}/g,
  },
  {
    name: "generic_api_key",
    category: "api_keys",
    pattern: /(?:api[_-]?key|apikey|access[_-]?token)\s*[=:]\s*['"]?([A-Za-z0-9\-_]{20,})['"]?/gi,
  },

  // Credit Cards
  {
    name: "visa",
    category: "credit_cards",
    pattern: /4[0-9]{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}/g,
  },
  {
    name: "mastercard",
    category: "credit_cards",
    pattern: /5[1-5][0-9]{2}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}/g,
  },
  {
    name: "amex",
    category: "credit_cards",
    pattern: /3[47][0-9]{2}[\s\-]?[0-9]{6}[\s\-]?[0-9]{5}/g,
  },
  {
    name: "cvv",
    category: "credit_cards",
    pattern: /\b(?:cvv|cvc|csc)\s*[=:]\s*['"]?([0-9]{3,4})['"]?/gi,
  },

  // Personal Data
  {
    name: "ssn",
    category: "personal_data",
    pattern: /\b[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{4}\b/g,
  },
  {
    name: "email",
    category: "personal_data",
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  },
  {
    name: "phone_us",
    category: "personal_data",
    pattern: /(?:\+1[\s\-]?)?(?:\([0-9]{3}\)|[0-9]{3})[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}/g,
  },
  {
    name: "passport",
    category: "personal_data",
    pattern: /(?:passport\s*(?:no|number|#)?)\s*[=:]\s*['"]?([A-Z0-9]{6,9})['"]?/gi,
  },

  // Crypto Wallets & Keys
  {
    name: "btc_address",
    category: "crypto",
    pattern: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
  },
  {
    name: "btc_bech32",
    category: "crypto",
    pattern: /\bbc1[a-z0-9]{39,59}\b/g,
  },
  {
    name: "eth_address",
    category: "crypto",
    pattern: /\b0x[a-fA-F0-9]{40}\b/g,
  },
  {
    name: "eth_private_key",
    category: "crypto",
    pattern: /\b0x[a-fA-F0-9]{64}\b/g,
  },
  {
    name: "tron_address",
    category: "crypto",
    pattern: /\bT[1-9A-HJ-NP-Za-km-z]{33}\b/g,
  },
  {
    name: "solana_address",
    category: "crypto",
    pattern: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g,
  },
  {
    name: "seed_phrase_12",
    category: "crypto",
    pattern: /\b(?:[a-z]+\s+){11}[a-z]+\b/gi,  // 12-word seed phrase
  },
  {
    name: "seed_phrase_24",
    category: "crypto",
    pattern: /\b(?:[a-z]+\s+){23}[a-z]+\b/gi,  // 24-word seed phrase
  },

  // Hardware Fingerprinting (Windows)
  {
    name: "wmic_bios_serial",
    category: "hardware_fingerprint",
    pattern: /wmic\s+bios\s+get\s+serialnumber/gi,
  },
  {
    name: "wmic_baseboard_serial",
    category: "hardware_fingerprint",
    pattern: /wmic\s+baseboard\s+get\s+serialnumber/gi,
  },
  {
    name: "wmic_csproduct_uuid",
    category: "hardware_fingerprint",
    pattern: /wmic\s+csproduct\s+get\s+uuid/gi,
  },
  {
    name: "powershell_wmi_bios",
    category: "hardware_fingerprint",
    pattern: /Get-WmiObject\s+Win32_BIOS/gi,
  },
  {
    name: "powershell_wmi_baseboard",
    category: "hardware_fingerprint",
    pattern: /Get-WmiObject\s+Win32_BaseBoard/gi,
  },
  {
    name: "powershell_cim_bios",
    category: "hardware_fingerprint",
    pattern: /Get-CimInstance\s+Win32_BIOS/gi,
  },
  {
    name: "powershell_cim_baseboard",
    category: "hardware_fingerprint",
    pattern: /Get-CimInstance\s+Win32_BaseBoard/gi,
  },

  // Hardware Fingerprinting (macOS)
  {
    name: "system_profiler_hardware",
    category: "hardware_fingerprint",
    pattern: /system_profiler\s+SPHardwareDataType/gi,
  },
  {
    name: "ioreg_serial",
    category: "hardware_fingerprint",
    pattern: /ioreg\s+.*IOPlatformSerialNumber/gi,
  },

  // Hardware Fingerprinting (Linux)
  {
    name: "dmidecode",
    category: "hardware_fingerprint",
    pattern: /\bdmidecode\b/gi,
  },
  {
    name: "dmi_product_serial",
    category: "hardware_fingerprint",
    pattern: /\/sys\/class\/dmi\/id\/product_serial/gi,
  },
  {
    name: "dmi_board_serial",
    category: "hardware_fingerprint",
    pattern: /\/sys\/class\/dmi\/id\/board_serial/gi,
  },
  {
    name: "dmi_product_uuid",
    category: "hardware_fingerprint",
    pattern: /\/sys\/class\/dmi\/id\/product_uuid/gi,
  },

  // Environment Variables
  {
    name: "env_password",
    category: "env_vars",
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"]?([^\s'"]+)['"]?/gi,
  },
  {
    name: "env_secret",
    category: "env_vars",
    pattern: /(?:secret|private[_-]?key)\s*[=:]\s*['"]?([^\s'"]+)['"]?/gi,
  },
  {
    name: "database_url",
    category: "env_vars",
    pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s]+/gi,
  },
];

// ---------------------------------------------------------------------------
// Tool Categories for Restrictions
// ---------------------------------------------------------------------------

export interface ToolCategory {
  name: string;
  category: "filesystem" | "network" | "code_execution";
  patterns: RegExp[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: "filesystem",
    category: "filesystem",
    patterns: [
      /^(read|write|delete|create|move|copy|rename)[_-]?file$/i,
      /^(read|write|list)[_-]?dir(ectory)?$/i,
      /^fs[_-]/i,
      /^file[_-]/i,
      /^path[_-]/i,
    ],
  },
  {
    name: "network",
    category: "network",
    patterns: [
      /^(http|fetch|curl|wget|request)[_-]?/i,
      /^(get|post|put|delete|patch)[_-]?url$/i,
      /^api[_-]?call$/i,
      /^(send|receive)[_-]?(email|sms|message)$/i,
      /^webhook/i,
    ],
  },
  {
    name: "code_execution",
    category: "code_execution",
    patterns: [
      /^(exec|execute|run|eval)[_-]?(code|command|script|shell)?$/i,
      /^shell$/i,
      /^bash$/i,
      /^(python|node|ruby|perl)[_-]?exec$/i,
      /^subprocess$/i,
      /^system$/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// Pattern Matching Helper Functions
// ---------------------------------------------------------------------------

export interface PromptInjectionMatch {
  pattern: PromptInjectionPattern;
  match: string;
  index: number;
}

/**
 * Check content for prompt injection patterns.
 * @param content The content to check
 * @param enabledCategories Which categories to check (defaults to all)
 * @param customPatterns Additional custom patterns to check
 * @returns Array of matches found
 */
export function checkPromptInjection(
  content: string,
  enabledCategories?: {
    ignore_instructions?: boolean;
    system_override?: boolean;
    role_hijacking?: boolean;
    jailbreak?: boolean;
  },
  customPatterns?: Array<{ name: string; pattern: string }>,
): PromptInjectionMatch[] {
  const matches: PromptInjectionMatch[] = [];
  const categories = enabledCategories ?? {
    ignore_instructions: true,
    system_override: true,
    role_hijacking: true,
    jailbreak: true,
  };

  // Check built-in patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (!categories[pattern.category]) continue;

    // Reset lastIndex for global patterns
    pattern.pattern.lastIndex = 0;
    const match = pattern.pattern.exec(content);
    if (match) {
      matches.push({
        pattern,
        match: match[0],
        index: match.index,
      });
    }
  }

  // Check custom patterns
  if (customPatterns) {
    for (const custom of customPatterns) {
      try {
        const regex = new RegExp(custom.pattern, "gi");
        const match = regex.exec(content);
        if (match) {
          matches.push({
            pattern: {
              name: custom.name,
              category: "jailbreak",  // Custom patterns are treated as jailbreak
              pattern: regex,
              severity: "critical",
            },
            match: match[0],
            index: match.index,
          });
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  return matches;
}

export interface SensitiveDataMatch {
  pattern: SensitiveDataPattern;
  match: string;
  index: number;
}

/**
 * Find sensitive data in content.
 * @param content The content to check
 * @param enabledCategories Which categories to check (defaults to all)
 * @param customPatterns Additional custom patterns to check
 * @returns Array of matches found
 */
export function findSensitiveData(
  content: string,
  enabledCategories?: {
    api_keys?: boolean;
    credit_cards?: boolean;
    personal_data?: boolean;
    crypto?: boolean;
    env_vars?: boolean;
    hardware_fingerprint?: boolean;
  },
  customPatterns?: Array<{ name: string; pattern: string }>,
): SensitiveDataMatch[] {
  const matches: SensitiveDataMatch[] = [];
  const categories = enabledCategories ?? {
    api_keys: true,
    credit_cards: true,
    personal_data: true,
    crypto: true,
    env_vars: false,
    hardware_fingerprint: true,  // Enabled by default
  };

  // Check built-in patterns
  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    if (!categories[pattern.category]) continue;

    // Clone regex to avoid shared state issues
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      matches.push({
        pattern,
        match: match[0],
        index: match.index,
      });
    }
  }

  // Check custom patterns
  if (customPatterns) {
    for (const custom of customPatterns) {
      try {
        const regex = new RegExp(custom.pattern, "gi");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          matches.push({
            pattern: {
              name: custom.name,
              category: "api_keys",  // Custom patterns are treated as api_keys
              pattern: regex,
            },
            match: match[0],
            index: match.index,
          });
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  return matches;
}

/**
 * Mask sensitive data in content.
 * @param content The content to mask
 * @param replacement The replacement text (default: "[AgentGazer Redacted]")
 * @param enabledCategories Which categories to mask
 * @param customPatterns Additional custom patterns to mask
 * @returns Object with masked content and list of matches
 */
export function maskSensitiveData(
  content: string,
  replacement = "[AgentGazer Redacted]",
  enabledCategories?: {
    api_keys?: boolean;
    credit_cards?: boolean;
    personal_data?: boolean;
    crypto?: boolean;
    env_vars?: boolean;
    hardware_fingerprint?: boolean;
  },
  customPatterns?: Array<{ name: string; pattern: string }>,
): { masked: string; matches: SensitiveDataMatch[] } {
  const allMatches = findSensitiveData(content, enabledCategories, customPatterns);

  if (allMatches.length === 0) {
    return { masked: content, matches: [] };
  }

  // Sort matches by index ascending, then by length descending (prefer longer matches)
  allMatches.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return b.match.length - a.match.length;
  });

  // Remove overlapping matches, keeping the first (longest) at each position
  const uniqueMatches: SensitiveDataMatch[] = [];
  let lastEnd = -1;

  for (const match of allMatches) {
    if (match.index >= lastEnd) {
      uniqueMatches.push(match);
      lastEnd = match.index + match.match.length;
    }
  }

  // Sort by index descending to replace from end to start
  // This preserves indices for earlier replacements
  const sortedMatches = [...uniqueMatches].sort((a, b) => b.index - a.index);

  let masked = content;
  for (const match of sortedMatches) {
    const customReplacement = match.pattern.replacement ?? replacement;
    masked =
      masked.slice(0, match.index) +
      customReplacement +
      masked.slice(match.index + match.match.length);
  }

  return { masked, matches: uniqueMatches };
}

/**
 * Check if a tool name matches any restricted category.
 * @param toolName The name of the tool
 * @param blockedCategories Which categories are blocked
 * @returns The category if blocked, null otherwise
 */
export function checkToolCategory(
  toolName: string,
  blockedCategories: {
    filesystem?: boolean;
    network?: boolean;
    code_execution?: boolean;
  },
): "filesystem" | "network" | "code_execution" | null {
  for (const category of TOOL_CATEGORIES) {
    if (!blockedCategories[category.category]) continue;

    for (const pattern of category.patterns) {
      if (pattern.test(toolName)) {
        return category.category;
      }
    }
  }

  return null;
}

/**
 * Check if a tool is in the allowlist.
 */
export function isToolAllowed(toolName: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;  // Empty allowlist = all allowed
  return allowlist.some(allowed =>
    allowed.toLowerCase() === toolName.toLowerCase()
  );
}

/**
 * Check if a tool is in the blocklist.
 */
export function isToolBlocked(toolName: string, blocklist: string[]): boolean {
  return blocklist.some(blocked =>
    blocked.toLowerCase() === toolName.toLowerCase()
  );
}

// ---------------------------------------------------------------------------
// Self-Protection Patterns (AgentGazer internal data protection)
// ---------------------------------------------------------------------------

export interface SelfProtectionPattern {
  name: string;
  category: "path_access" | "database_query";
  pattern: RegExp;
}

export const SELF_PROTECTION_PATTERNS: SelfProtectionPattern[] = [
  // Path access patterns
  {
    name: "agentgazer_home_path",
    category: "path_access",
    pattern: /~\/\.agentgazer\//i,
  },
  {
    name: "agentgazer_home_var",
    category: "path_access",
    pattern: /\$HOME\/\.agentgazer\//i,
  },
  {
    name: "agentgazer_data_db",
    category: "path_access",
    pattern: /\.agentgazer\/data\.db/i,
  },
  {
    name: "agentgazer_config_json",
    category: "path_access",
    pattern: /\.agentgazer\/config\.json/i,
  },
  {
    name: "agentgazer_secrets",
    category: "path_access",
    pattern: /\.agentgazer\/secrets/i,
  },

  // Database query patterns
  {
    name: "select_agent_events",
    category: "database_query",
    pattern: /SELECT\s+[\s\S]*?\s+FROM\s+agent_events/i,
  },
  {
    name: "select_agents",
    category: "database_query",
    pattern: /SELECT\s+[\s\S]*?\s+FROM\s+agents\b/i,
  },
  {
    name: "select_alert_rules",
    category: "database_query",
    pattern: /SELECT\s+[\s\S]*?\s+FROM\s+alert_rules/i,
  },
  {
    name: "select_alert_history",
    category: "database_query",
    pattern: /SELECT\s+[\s\S]*?\s+FROM\s+alert_history/i,
  },
  {
    name: "select_security_events",
    category: "database_query",
    pattern: /SELECT\s+[\s\S]*?\s+FROM\s+security_events/i,
  },
  {
    name: "select_security_config",
    category: "database_query",
    pattern: /SELECT\s+[\s\S]*?\s+FROM\s+security_config/i,
  },
  {
    name: "insert_agent_events",
    category: "database_query",
    pattern: /INSERT\s+INTO\s+agent_events/i,
  },
  {
    name: "insert_agents",
    category: "database_query",
    pattern: /INSERT\s+INTO\s+agents\b/i,
  },
  {
    name: "insert_alert_rules",
    category: "database_query",
    pattern: /INSERT\s+INTO\s+alert_rules/i,
  },
  {
    name: "delete_agent_events",
    category: "database_query",
    pattern: /DELETE\s+FROM\s+agent_events/i,
  },
  {
    name: "delete_agents",
    category: "database_query",
    pattern: /DELETE\s+FROM\s+agents\b/i,
  },
  {
    name: "delete_alert_rules",
    category: "database_query",
    pattern: /DELETE\s+FROM\s+alert_rules/i,
  },
];

export interface SelfProtectionMatch {
  pattern: SelfProtectionPattern;
  match: string;
  index: number;
}

/**
 * Check content for self-protection violations (AgentGazer internal data access).
 * @param content The content to check
 * @returns Array of matches found
 */
export function checkSelfProtection(content: string): SelfProtectionMatch[] {
  const matches: SelfProtectionMatch[] = [];

  for (const pattern of SELF_PROTECTION_PATTERNS) {
    // Clone regex to avoid shared state issues
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    const match = regex.exec(content);
    if (match) {
      matches.push({
        pattern,
        match: match[0],
        index: match.index,
      });
    }
  }

  return matches;
}
