/**
 * SimHash - Locality Sensitive Hashing for text similarity detection.
 * Used by Google for web page deduplication.
 *
 * Similar texts produce hashes with small Hamming distance.
 * Different texts produce hashes with large Hamming distance.
 */

// 64-bit SimHash using bigint
const HASH_BITS = 64n;

/**
 * Simple string hash function (FNV-1a variant)
 */
function hashToken(token: string): bigint {
  let hash = 0xcbf29ce484222325n; // FNV offset basis
  for (let i = 0; i < token.length; i++) {
    hash ^= BigInt(token.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n); // FNV prime
  }
  return hash;
}

/**
 * Tokenize text into n-grams (default: 3-grams)
 */
function tokenize(text: string, n = 3): string[] {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalized.length < n) {
    return [normalized];
  }

  const tokens: string[] = [];
  for (let i = 0; i <= normalized.length - n; i++) {
    tokens.push(normalized.slice(i, i + n));
  }
  return tokens;
}

/**
 * Compute 64-bit SimHash for text.
 *
 * Algorithm:
 * 1. Tokenize text into n-grams
 * 2. Hash each token to 64-bit value
 * 3. For each bit position, sum +1 if bit is 1, -1 if bit is 0
 * 4. Final hash: bit is 1 if sum > 0, else 0
 */
export function computeSimHash(text: string): bigint {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return 0n;
  }

  // Vector of 64 counters (one per bit position)
  const vector: number[] = new Array(64).fill(0);

  for (const token of tokens) {
    const hash = hashToken(token);
    for (let i = 0; i < 64; i++) {
      // Check if bit i is set
      if ((hash >> BigInt(i)) & 1n) {
        vector[i]++;
      } else {
        vector[i]--;
      }
    }
  }

  // Build final hash from vector
  let result = 0n;
  for (let i = 0; i < 64; i++) {
    if (vector[i] > 0) {
      result |= 1n << BigInt(i);
    }
  }

  return result;
}

/**
 * Compute Hamming distance between two SimHash values.
 * Returns the number of differing bits.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let count = 0;

  // Count set bits (Brian Kernighan's algorithm)
  while (xor > 0n) {
    xor &= xor - 1n;
    count++;
  }

  return count;
}

/**
 * Check if two SimHash values are similar.
 * Default threshold of 3 bits difference is commonly used.
 */
export function isSimilar(a: bigint, b: bigint, threshold = 3): boolean {
  return hammingDistance(a, b) <= threshold;
}
