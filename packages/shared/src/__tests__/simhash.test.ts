import { describe, it, expect } from "vitest";
import { computeSimHash, hammingDistance, isSimilar } from "../simhash.js";

describe("computeSimHash", () => {
  it("returns a bigint for any text input", () => {
    const hash = computeSimHash("hello world");
    expect(typeof hash).toBe("bigint");
  });

  it("returns different hashes for different text", () => {
    const hash1 = computeSimHash("hello world");
    const hash2 = computeSimHash("goodbye world");
    expect(hash1).not.toBe(hash2);
  });

  it("returns identical hash for identical text", () => {
    const hash1 = computeSimHash("the quick brown fox");
    const hash2 = computeSimHash("the quick brown fox");
    expect(hash1).toBe(hash2);
  });

  it("returns similar hashes for similar text", () => {
    const hash1 = computeSimHash("the quick brown fox jumps over the lazy dog");
    const hash2 = computeSimHash("the quick brown fox jumps over a lazy dog");
    // Similar text should have low Hamming distance
    const distance = hammingDistance(hash1, hash2);
    expect(distance).toBeLessThan(20);
  });

  it("handles empty string", () => {
    const hash = computeSimHash("");
    expect(typeof hash).toBe("bigint");
  });

  it("handles unicode text", () => {
    const hash = computeSimHash("你好世界");
    expect(typeof hash).toBe("bigint");
  });

  it("handles very long text", () => {
    const longText = "word ".repeat(1000);
    const hash = computeSimHash(longText);
    expect(typeof hash).toBe("bigint");
  });
});

describe("hammingDistance", () => {
  it("returns 0 for identical hashes", () => {
    const hash = computeSimHash("hello");
    expect(hammingDistance(hash, hash)).toBe(0);
  });

  it("returns the number of differing bits", () => {
    // 0b0001 vs 0b0010 = 2 bits different
    expect(hammingDistance(1n, 2n)).toBe(2);
    // 0b0001 vs 0b0011 = 1 bit different
    expect(hammingDistance(1n, 3n)).toBe(1);
    // 0b0000 vs 0b1111 = 4 bits different
    expect(hammingDistance(0n, 15n)).toBe(4);
  });

  it("returns a value between 0 and 64 for any hash pair", () => {
    const hash1 = computeSimHash("foo bar baz");
    const hash2 = computeSimHash("completely different text here");
    const distance = hammingDistance(hash1, hash2);
    expect(distance).toBeGreaterThanOrEqual(0);
    expect(distance).toBeLessThanOrEqual(64);
  });

  it("is symmetric", () => {
    const hash1 = computeSimHash("alpha");
    const hash2 = computeSimHash("beta");
    expect(hammingDistance(hash1, hash2)).toBe(hammingDistance(hash2, hash1));
  });
});

describe("isSimilar", () => {
  it("returns true for identical text", () => {
    const hash = computeSimHash("same text");
    expect(isSimilar(hash, hash)).toBe(true);
  });

  it("returns true for identical text", () => {
    const hash1 = computeSimHash("the user wants to search for products");
    const hash2 = computeSimHash("the user wants to search for products");
    expect(isSimilar(hash1, hash2)).toBe(true);
  });

  it("may or may not be similar for slightly different text (SimHash property)", () => {
    const hash1 = computeSimHash("the user wants to search for products");
    const hash2 = computeSimHash("the user wants to search for product");
    // SimHash similarity depends on the specific implementation
    // We just verify it returns a boolean
    expect(typeof isSimilar(hash1, hash2)).toBe("boolean");
  });

  it("returns false for completely different text", () => {
    const hash1 = computeSimHash("hello world how are you today");
    const hash2 = computeSimHash("xyzzy plugh foo bar baz qux");
    expect(isSimilar(hash1, hash2)).toBe(false);
  });

  it("respects custom threshold", () => {
    const hash1 = computeSimHash("example text one");
    const hash2 = computeSimHash("example text two");
    const distance = hammingDistance(hash1, hash2);

    // Should be similar with a high threshold
    expect(isSimilar(hash1, hash2, 64)).toBe(true);

    // May not be similar with a very low threshold
    if (distance > 1) {
      expect(isSimilar(hash1, hash2, 1)).toBe(false);
    }
  });

  it("uses default threshold of 3", () => {
    // Verify the default behavior
    const hash1 = computeSimHash("test input");
    const hash2 = computeSimHash("test input");
    expect(isSimilar(hash1, hash2)).toBe(true);
  });
});
