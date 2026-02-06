class Agenttrace < Formula
  desc "Local-first AI agent observability platform"
  homepage "https://github.com/agenttrace/agenttrace"
  url "https://registry.npmjs.org/@agenttrace/cli/-/cli-0.1.3.tgz"
  sha256 "660b2b3221d0a9552b98e9faeb0247cd33e06a404ddf6e79c95d20cb380870be"
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
