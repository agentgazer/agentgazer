# Troubleshooting

## Events are not appearing in the dashboard

1. **Verify the Token is correct**: Ensure the Token used by the SDK or Proxy matches the one in `~/.agentgazer/config.json`
2. **Check endpoint configuration**: Confirm the endpoint points to `http://localhost:18800/api/events`
3. **Ensure the buffer has been flushed**: Events may still be in the buffer. Call `at.shutdown()` to force a flush, or wait for the 5-second auto-flush cycle
4. **Check console warnings**: SDK network errors do not throw exceptions but are logged as warnings in the console

## Proxy cannot detect the Provider

1. **Use path prefix routing**: This is the most reliable method. For example, set the base URL to `http://localhost:18900/openai/v1`
2. **Use x-target-url**: Add the `x-target-url` header to explicitly specify the target
3. **Check the Provider detection order**: Path prefix -> Host header -> Path pattern -> x-target-url
4. **Check the Proxy logs**: The Proxy outputs detection results and warnings to the console

## Receiving 429 Too Many Requests

1. **Rate limit**: Maximum of 1,000 events per minute
2. **Increase buffer size**: A larger `maxBufferSize` reduces flush frequency
3. **Check Retry-After**: The `Retry-After` header in the response indicates how many seconds to wait

## Agent status shows "unknown"

1. **Confirm heartbeats are being sent**: Use `at.heartbeat()` to send heartbeats periodically (recommended every 30 seconds)
2. **Timeout threshold**: If no heartbeat is received for more than 10 minutes, the Agent is marked as "down"

## Dashboard login fails

1. **Verify the Token**: Check the Token in `~/.agentgazer/config.json`
2. **Regenerate the Token**: Run `agentgazer reset-token` to generate a new Token
3. **Confirm the server is running**: Run `agentgazer doctor` to check server status

## Cost calculations are incorrect

1. **Verify model names**: Cost calculation relies on the pricing table in `@agentgazer/shared`. Model name lookup is case-insensitive (e.g., both `GPT-4o` and `gpt-4o` will match)
2. **Negative token values**: If negative token counts are passed, cost calculation returns `null`
3. **Manually specify cost_usd**: If automatic calculation is inaccurate, pass the `cost_usd` field manually in `track()`

## Port conflicts

If the default ports are already in use, start with custom ports:

```bash
agentgazer start --port 9090 --proxy-port 5000
```

## Database issues

The SQLite database is located at `~/.agentgazer/data.db`. To reset it:

```bash
# Stop the service, then delete the database file
rm ~/.agentgazer/data.db

# Restart — the system will automatically create a new database
agentgazer start
```
