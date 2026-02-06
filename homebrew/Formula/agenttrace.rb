class Agenttrace < Formula
  desc "Local-first AI agent observability platform"
  homepage "https://github.com/agenttrace/agenttrace"
  url "https://registry.npmjs.org/@agenttrace/cli/-/cli-0.1.4.tgz"
  sha256 "fcf4bcc8a1fe0551f3deef1aa9e5f6e12132424983a1acbb8ba261f5157d70f2"
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
