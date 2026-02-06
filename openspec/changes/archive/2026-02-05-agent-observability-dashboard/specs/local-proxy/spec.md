## ADDED Requirements

### Requirement: Configurable proxy port

The local proxy server SHALL start on a configurable port. The default port MUST be 4000. The user MUST be able to override the port via a CLI flag or environment variable.

#### Scenario: Start on default port

WHEN a user starts the proxy without specifying a port
THEN the proxy MUST listen on port 4000.

#### Scenario: Start on custom port

WHEN a user starts the proxy with `--port 5050`
THEN the proxy MUST listen on port 5050.

### Requirement: Intercept requests to known LLM providers

The local proxy server SHALL intercept HTTP requests destined for the following known LLM providers: OpenAI, Anthropic, Google AI, Mistral, and Cohere. The proxy MUST recognize requests targeting these providers based on the destination host or a provider header and MUST extract usage metrics from the responses.

#### Scenario: Intercept OpenAI request

WHEN the proxy receives a request intended for the OpenAI API
THEN the proxy MUST forward the request to the real OpenAI endpoint, receive the response, extract usage metrics, and return the response to the caller.

#### Scenario: Intercept Anthropic request

WHEN the proxy receives a request intended for the Anthropic API
THEN the proxy MUST forward the request to the real Anthropic endpoint, receive the response, extract usage metrics, and return the response to the caller.

#### Scenario: Intercept Google AI request

WHEN the proxy receives a request intended for the Google AI API
THEN the proxy MUST forward the request to the real Google AI endpoint, receive the response, extract usage metrics, and return the response to the caller.

### Requirement: Base URL redirection

The user SHALL point their agent's LLM provider base URL to the local proxy (e.g., `http://localhost:4000`) instead of the real provider. The proxy MUST accept these requests and route them to the correct upstream provider endpoint transparently, so the agent code requires no changes beyond the base URL.

#### Scenario: Agent configured to use proxy as base URL

WHEN an agent sends an OpenAI chat completion request to `http://localhost:4000/v1/chat/completions` instead of `https://api.openai.com/v1/chat/completions`
THEN the proxy MUST forward the request to the real OpenAI endpoint and return the response unmodified to the agent.

### Requirement: Transparent request forwarding

The proxy SHALL forward all intercepted requests to the real provider URL transparently. The original request headers, body, and method MUST be preserved. The response from the provider MUST be returned to the calling agent unmodified, ensuring the proxy is invisible to the agent's application logic.

#### Scenario: Request and response pass through unmodified

WHEN the proxy forwards a request to an upstream provider and receives a response
THEN the response status code, headers, and body returned to the agent MUST match the upstream provider's response exactly.

#### Scenario: Request headers preserved

WHEN the proxy receives a request with an `Authorization` header containing the user's provider API key
THEN the proxy MUST forward that header to the upstream provider unchanged.

### Requirement: Metric extraction from responses

The proxy SHALL extract the following metrics from LLM provider responses: token counts (prompt tokens and completion tokens), model name, and request latency (measured as round-trip time from proxy to provider). These metrics MUST be extracted from the provider's response body using the standard response format for each supported provider.

#### Scenario: Extract token counts from OpenAI response

WHEN the proxy receives an OpenAI response containing a `usage` object with `prompt_tokens` and `completion_tokens`
THEN the proxy MUST extract both token count values as metrics.

#### Scenario: Extract model name from response

WHEN the proxy receives a provider response containing a `model` field
THEN the proxy MUST extract the model name as a metric.

#### Scenario: Measure request latency

WHEN the proxy forwards a request to a provider and receives the response
THEN the proxy MUST record the round-trip latency in milliseconds as a metric.

### Requirement: Cost calculation

The proxy SHALL calculate the estimated cost of each LLM API call using a built-in pricing table. The pricing table MUST contain per-token rates for supported models from all known providers. The calculated cost MUST be included in the metrics reported to the ingest API.

#### Scenario: Calculate cost for a known model

WHEN the proxy extracts 1000 prompt tokens and 500 completion tokens for a request to `gpt-4`
THEN the proxy MUST calculate the cost using the built-in pricing rates for `gpt-4` and include the cost in the reported metrics.

#### Scenario: Unknown model pricing

WHEN the proxy encounters a model that is not in the built-in pricing table
THEN the proxy MUST still report the token counts and latency metrics and SHALL set the cost field to `null` or zero.

### Requirement: Report metrics to ingest API without content

The proxy SHALL report extracted metrics to the ingest API after each intercepted request. The reported data MUST include token counts, model name, latency, calculated cost, and provider name. The proxy MUST NOT send prompt content, completion content, or any part of the request/response body to the ingest API. Only statistical metrics SHALL be transmitted.

#### Scenario: Metrics reported after completion

WHEN the proxy successfully extracts metrics from a provider response
THEN the proxy MUST send a `completion` event to the ingest API containing token counts, model name, latency, cost, and provider name.

#### Scenario: Prompt content not transmitted

WHEN the proxy reports metrics for a request that included a user prompt and received a completion
THEN the reported event MUST NOT contain any prompt text, completion text, or message content.

### Requirement: CLI startup command

The proxy SHALL be startable via the command `npx agentgazer-proxy --api-key <key> --agent-id <id>`. The `--api-key` and `--agent-id` flags MUST be required. If either is missing, the CLI MUST print a usage error and exit with a non-zero status code.

#### Scenario: Start proxy with required flags

WHEN a user runs `npx agentgazer-proxy --api-key ak_test123 --agent-id bot-1`
THEN the proxy MUST start and begin listening for requests on the configured port.

#### Scenario: Missing api-key flag

WHEN a user runs `npx agentgazer-proxy --agent-id bot-1` without `--api-key`
THEN the CLI MUST print an error indicating that `--api-key` is required and MUST exit with a non-zero status code.

#### Scenario: Missing agent-id flag

WHEN a user runs `npx agentgazer-proxy --api-key ak_test123` without `--agent-id`
THEN the CLI MUST print an error indicating that `--agent-id` is required and MUST exit with a non-zero status code.

### Requirement: HTTPS provider endpoint support

The proxy SHALL support forwarding requests to upstream provider endpoints that use HTTPS. The proxy MUST establish TLS connections to provider endpoints and MUST validate server certificates.

#### Scenario: Forward to HTTPS endpoint

WHEN the proxy forwards a request to `https://api.openai.com/v1/chat/completions`
THEN the proxy MUST establish a TLS connection and successfully complete the request.

### Requirement: Graceful handling of unrecognized providers

The proxy SHALL handle requests destined for providers not in its known list gracefully. For unrecognized providers, the proxy MUST forward the request and response transparently but SHALL skip metric extraction. The proxy MUST log a warning indicating that the provider was not recognized.

#### Scenario: Unrecognized provider request

WHEN the proxy receives a request for a provider not in the known list (e.g., a custom LLM endpoint)
THEN the proxy MUST forward the request to the target URL, return the response to the agent, skip metric extraction, and log a warning.

#### Scenario: Unrecognized provider does not cause errors

WHEN the proxy receives a request for an unrecognized provider
THEN the proxy MUST NOT crash or return an error to the agent.
