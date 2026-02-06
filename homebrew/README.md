# AgentTrace Homebrew Tap

Homebrew formula for [AgentTrace](https://github.com/agenttrace/agenttrace).

## Usage

```bash
# Install
brew install agenttrace/tap/agenttrace

# Or add the tap first
brew tap agenttrace/tap
brew install agenttrace
```

## Publishing as a Tap

To make this formula available as a Homebrew tap:

1. Create a GitHub repository named `homebrew-tap` under the `agenttrace` organization
2. Copy the `Formula/` directory into the repo root
3. Users can then install with `brew install agenttrace/tap/agenttrace`

### Updating the Formula

When a new version is published to npm:

1. Download the new tarball: `npm pack agenttrace@<version>`
2. Compute the SHA256: `shasum -a 256 agenttrace-<version>.tgz`
3. Update `url` and `sha256` in `Formula/agenttrace.rb`
4. Push to the tap repository

### Testing Locally

```bash
# Install from local formula
brew install --formula ./Formula/agenttrace.rb

# Run the built-in test
brew test agenttrace
```
