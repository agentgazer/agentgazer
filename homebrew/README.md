# AgentGazer Homebrew Tap

Homebrew formula for [AgentGazer](https://github.com/agentgazer/agentgazer).

## Usage

```bash
# Install
brew install agentgazer/tap/agentgazer

# Or add the tap first
brew tap agentgazer/tap
brew install agentgazer
```

## Publishing as a Tap

To make this formula available as a Homebrew tap:

1. Create a GitHub repository named `homebrew-tap` under the `agentgazer` organization
2. Copy the `Formula/` directory into the repo root
3. Users can then install with `brew install agentgazer/tap/agentgazer`

### Updating the Formula

When a new version is published to npm:

1. Download the new tarball: `npm pack agentgazer@<version>`
2. Compute the SHA256: `shasum -a 256 agentgazer-<version>.tgz`
3. Update `url` and `sha256` in `Formula/agentgazer.rb`
4. Push to the tap repository

### Testing Locally

```bash
# Install from local formula
brew install --formula ./Formula/agentgazer.rb

# Run the built-in test
brew test agentgazer
```
