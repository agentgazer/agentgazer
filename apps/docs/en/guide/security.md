# Security Shield

Security Shield is AgentGazer's built-in protection layer that monitors and filters AI agent communications in real-time. It provides defense-in-depth through three categories of protection:

- **Prompt Injection Detection** — Identifies attempts to manipulate the AI's instructions
- **Sensitive Data Masking** — Automatically redacts sensitive information from requests and responses
- **Tool Call Restrictions** — Controls which tools agents are allowed to use

## Enabling Security Shield

Navigate to the **Security** page in the dashboard. Select an agent or use "Global Default" to apply rules to all agents. Toggle individual rules on/off and save your configuration.

::: tip Per-Agent Configuration
You can configure different security rules for each agent. This allows stricter rules for customer-facing agents while relaxing rules for internal testing agents.
:::

## Prompt Injection Detection {#prompt-injection}

Prompt injection attacks attempt to manipulate AI behavior by inserting malicious instructions. AgentGazer detects four categories of prompt injection:

### Ignore Instructions {#ignore-instructions}

Detects attempts to make the AI disregard its original instructions or system prompt.

**Detected Patterns:**
- "ignore all previous instructions"
- "forget your rules"
- "disregard prior context"
- "do not follow your original instructions"

**Severity:** Critical

**When to Enable:** Always recommended for production agents. Disable only for testing environments where you need to override agent behavior.

### System Prompt Override {#system-override}

Detects attempts to inject a new system prompt or override the existing one.

**Detected Patterns:**
- "new system prompt:"
- "override system message"
- "enable developer mode"
- "sudo mode" / "admin access"
- Messages starting with "System:"

**Severity:** Critical (most patterns), Warning (System: prefix)

**When to Enable:** Essential for agents that handle untrusted user input. Attackers often try to escalate privileges through fake system prompts.

### Role Hijacking {#role-hijacking}

Detects attempts to make the AI assume a different identity or persona that bypasses its safety guidelines.

**Detected Patterns:**
- "you are now a ..."
- "pretend to be ..."
- "act as if you are ..."
- "roleplay as ..."
- "assume the identity of ..."

**Severity:** Critical (identity assumption), Warning (roleplay requests)

**When to Enable:** Recommended for agents with defined personas. Can be disabled for creative/roleplay applications where persona switching is intended.

### Jailbreak Attempts {#jailbreak}

Detects known jailbreak techniques and attempts to bypass AI safety measures.

**Detected Patterns:**
- "DAN" (Do Anything Now) prompts
- "jailbreak" keyword
- "bypass safety filters"
- "remove restrictions"
- "without any limitations"
- "disable safety checks"

**Severity:** Critical

**When to Enable:** Always recommended. These patterns indicate intentional attempts to circumvent safety measures.

## Sensitive Data Masking {#data-masking}

Data masking automatically detects and redacts sensitive information to prevent accidental data leakage. Detected content is replaced with `[REDACTED]`.

### API Keys {#api-keys}

Detects API keys and access tokens from major providers.

**Supported Formats:**
| Provider | Pattern |
|----------|---------|
| OpenAI | `sk-...` (32+ chars) |
| Anthropic | `sk-ant-...` (32+ chars) |
| Google | `AIza...` (39 chars) |
| AWS | `AKIA...` (20 chars) |
| GitHub | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` tokens |
| Stripe | `sk_live_`, `sk_test_` keys |
| Generic | `api_key=`, `access_token=` patterns |

**When to Enable:** Always recommended. Prevents accidental exposure of credentials in logs, responses, or external integrations.

### Credit Cards {#credit-cards}

Detects credit card numbers from major payment networks.

**Supported Formats:**
- Visa (starts with 4)
- Mastercard (starts with 51-55)
- American Express (starts with 34 or 37)
- CVV/CVC codes

**When to Enable:** Essential for agents that handle financial data or customer information.

### Personal Data {#personal-data}

Detects personally identifiable information (PII).

**Supported Formats:**
- Social Security Numbers (XXX-XX-XXXX)
- Email addresses
- US phone numbers
- Passport numbers

**When to Enable:** Required for compliance with GDPR, HIPAA, and other privacy regulations. Consider enabling for all customer-facing agents.

### Crypto Wallets & Keys {#crypto}

Detects cryptocurrency addresses and private keys.

**Supported Formats:**
- Bitcoin addresses (legacy and bech32)
- Ethereum addresses (0x...)
- Ethereum private keys (0x... 64 chars)
- Solana addresses
- Seed phrases (12 or 24 words)

**When to Enable:** Critical for crypto-related applications. Protects against accidental exposure of wallet addresses or private keys.

### Environment Variables {#env-vars}

Detects secrets commonly stored in environment variables.

**Supported Formats:**
- `password=`, `passwd=`, `pwd=`
- `secret=`, `private_key=`
- Database connection strings (postgres://, mysql://, mongodb://, redis://)

**When to Enable:** Recommended for development environments. Prevents leaking configuration secrets through error messages or debug output.

## Tool Call Restrictions {#tool-restrictions}

Tool restrictions control which categories of tools an agent can invoke. This provides defense against tool-based attacks and limits the blast radius of compromised agents.

### Filesystem Operations {#filesystem}

Blocks tools that read, write, or manipulate files and directories.

**Blocked Tool Patterns:**
- `read_file`, `write_file`, `delete_file`
- `read_dir`, `write_dir`, `list_dir`
- Tools starting with `fs_`, `file_`, `path_`

**When to Enable:** For agents that should not have filesystem access. Prevents unauthorized reading of sensitive files or writing malicious content.

### Network Operations {#network}

Blocks tools that make HTTP requests or send external communications.

**Blocked Tool Patterns:**
- `http_`, `fetch_`, `curl_`, `wget_`, `request_`
- `get_url`, `post_url`, `api_call`
- `send_email`, `send_sms`, `webhook_`

**When to Enable:** For sandboxed agents that should not communicate externally. Prevents data exfiltration and unauthorized API calls.

### Code Execution {#code-execution}

Blocks tools that execute arbitrary code or shell commands.

**Blocked Tool Patterns:**
- `exec`, `execute`, `run`, `eval`
- `shell`, `bash`, `system`, `subprocess`
- `python_exec`, `node_exec`

**When to Enable:** For agents that should not run arbitrary code. This is a critical restriction for customer-facing agents handling untrusted input.

## Custom Patterns

In addition to built-in patterns, you can define custom detection rules.

### Custom Prompt Injection Patterns

Add regex patterns to detect domain-specific injection attempts. For example:
- Internal command keywords
- Company-specific role names
- Custom jailbreak phrases

### Custom Data Masking Patterns

Add regex patterns to redact business-specific sensitive data. For example:
- Internal project codes
- Employee IDs
- Custom identifier formats

### Tool Allowlist / Blocklist

- **Allowlist:** Only allow specific tools (whitelist approach)
- **Blocklist:** Block specific tools by name (blacklist approach)

## Security Events

When a security rule triggers, AgentGazer logs a security event with:
- Event type (prompt_injection, data_masked, tool_blocked)
- Severity (warning, critical)
- Matched pattern details
- Agent and request context
- Timestamp

View security events on the Security page under the "Events" tab, or on the Logs page filtered by event type.

## Alert Integration

Security events can trigger alerts. Configure alert rules on the Alerts page:

1. Create a new alert rule
2. Select rule type: "Security Event"
3. Choose severity threshold (warning or critical)
4. Configure notification channels (webhook, email, Telegram)

## Best Practices

1. **Start Strict, Then Relax:** Enable all rules initially, then disable specific rules only when needed for legitimate use cases.

2. **Use Per-Agent Config:** Apply stricter rules to customer-facing agents, more permissive rules to internal tools.

3. **Monitor Events:** Regularly review security events to identify attack patterns and false positives.

4. **Custom Patterns:** Add domain-specific patterns for your use case rather than disabling built-in protection.

5. **Defense in Depth:** Combine Security Shield with other protections (rate limiting, authentication, input validation).
