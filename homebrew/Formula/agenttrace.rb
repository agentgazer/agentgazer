class Agenttrace < Formula
  desc "Local-first AI agent observability platform"
  homepage "https://github.com/agenttrace/agenttrace"
  url "https://registry.npmjs.org/agenttrace/-/agenttrace-0.1.0.tgz"
  sha256 "" # TODO: Fill in after publishing to npm — run: shasum -a 256 agenttrace-0.1.0.tgz
  license "Apache-2.0"

  depends_on "node@22"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  def post_install
    ohai "AgentTrace installed! Run 'agenttrace' to get started."
    ohai "First time? Run 'agenttrace onboard' to configure."
  end

  def caveats
    <<~EOS
      AgentTrace stores data in ~/.agenttrace/

      Quick start:
        agenttrace              Launch server + proxy + dashboard
        agenttrace onboard      First-time setup
        agenttrace --help       Show all commands

      Uninstalling via brew will NOT remove your data.
      To remove data: rm -rf ~/.agenttrace/
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/agenttrace version")
  end
end
