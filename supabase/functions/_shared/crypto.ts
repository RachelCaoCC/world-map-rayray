// Simple XOR-based token obfuscation for storage.
// NOTE: For production, use pgcrypto or a KMS. This is a placeholder
// that demonstrates the encrypt/decrypt interface.

const ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY") || "dev-key-change-in-production-32b!";

function xorCipher(input: Uint8Array, key: Uint8Array): Uint8Array {
  const output = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i] ^ key[i % key.length];
  }
  return output;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encryptToken(plaintext: string): string {
  const key = new TextEncoder().encode(ENCRYPTION_KEY);
  const data = new TextEncoder().encode(plaintext);
  return toBase64(xorCipher(data, key));
}

export function decryptToken(ciphertext: string): string {
  const key = new TextEncoder().encode(ENCRYPTION_KEY);
  const data = fromBase64(ciphertext);
  return new TextDecoder().decode(xorCipher(data, key));
}
