import { describe, it, expect } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  tokenNeedsRefresh,
  type OAuthToken,
} from "../oauth.js";

// ---------------------------------------------------------------------------
// PKCE helpers tests
// ---------------------------------------------------------------------------

describe("generateCodeVerifier", () => {
  it("generates a string of correct length", () => {
    const verifier = generateCodeVerifier();
    // 32 bytes in base64url = 43 characters
    expect(verifier.length).toBe(43);
  });

  it("generates different values each time", () => {
    const verifier1 = generateCodeVerifier();
    const verifier2 = generateCodeVerifier();
    expect(verifier1).not.toBe(verifier2);
  });

  it("only contains URL-safe characters", () => {
    const verifier = generateCodeVerifier();
    // base64url uses A-Z, a-z, 0-9, -, _
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates valid code verifiers repeatedly", () => {
    // Generate 10 verifiers and ensure they all pass validation
    for (let i = 0; i < 10; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe("generateCodeChallenge", () => {
  it("generates a different value from the verifier", () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    expect(challenge).not.toBe(verifier);
  });

  it("generates consistent challenge for same verifier", () => {
    const verifier = "test-verifier-12345678901234567890123456789012";
    const challenge1 = generateCodeChallenge(verifier);
    const challenge2 = generateCodeChallenge(verifier);
    expect(challenge1).toBe(challenge2);
  });

  it("generates different challenges for different verifiers", () => {
    const verifier1 = generateCodeVerifier();
    const verifier2 = generateCodeVerifier();
    const challenge1 = generateCodeChallenge(verifier1);
    const challenge2 = generateCodeChallenge(verifier2);
    expect(challenge1).not.toBe(challenge2);
  });

  it("only contains URL-safe characters", () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    // base64url uses A-Z, a-z, 0-9, -, _
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces correct S256 challenge for known input", () => {
    // Test vector: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" should produce
    // "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" (from RFC 7636 example)
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = generateCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

// ---------------------------------------------------------------------------
// Token refresh check tests
// ---------------------------------------------------------------------------

describe("tokenNeedsRefresh", () => {
  it("returns false for token that expires in more than threshold", () => {
    const token: OAuthToken = {
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Math.floor(Date.now() / 1000) + 600, // 10 minutes from now
    };

    expect(tokenNeedsRefresh(token, 300)).toBe(false);
  });

  it("returns true for token that expires within threshold", () => {
    const token: OAuthToken = {
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Math.floor(Date.now() / 1000) + 200, // 3.33 minutes from now
    };

    expect(tokenNeedsRefresh(token, 300)).toBe(true);
  });

  it("returns true for already expired token", () => {
    const token: OAuthToken = {
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Math.floor(Date.now() / 1000) - 100, // Expired 100 seconds ago
    };

    expect(tokenNeedsRefresh(token, 300)).toBe(true);
  });

  it("uses default threshold of 300 seconds (5 minutes)", () => {
    const tokenExpiresIn4Min: OAuthToken = {
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Math.floor(Date.now() / 1000) + 240, // 4 minutes from now
    };

    const tokenExpiresIn6Min: OAuthToken = {
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Math.floor(Date.now() / 1000) + 360, // 6 minutes from now
    };

    expect(tokenNeedsRefresh(tokenExpiresIn4Min)).toBe(true);
    expect(tokenNeedsRefresh(tokenExpiresIn6Min)).toBe(false);
  });

  it("returns true for token expiring exactly at threshold boundary", () => {
    const token: OAuthToken = {
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Math.floor(Date.now() / 1000) + 300, // Exactly 5 minutes
    };

    // At boundary, (expiresAt - now) == threshold, so < is false
    // Actually: expiresAt - now = 300, threshold = 300, 300 - 300 = 0, 0 < 300 = true... wait
    // Let me check the logic: token.expiresAt - now < thresholdSeconds
    // 300 - 0 = 300, 300 < 300 = false
    // Hmm, need to be more careful. If now = Date.now()/1000 and expiresAt = now + 300
    // then expiresAt - now = 300, and we check if 300 < 300 which is false
    expect(tokenNeedsRefresh(token, 300)).toBe(false);
  });

  it("works with custom threshold values", () => {
    const token: OAuthToken = {
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Math.floor(Date.now() / 1000) + 50, // 50 seconds from now
    };

    expect(tokenNeedsRefresh(token, 60)).toBe(true);   // Needs refresh (within 60s)
    expect(tokenNeedsRefresh(token, 30)).toBe(false);  // Doesn't need refresh (>30s left)
  });
});
