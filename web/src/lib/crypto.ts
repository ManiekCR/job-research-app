import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended size for AES-GCM
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_MASTER_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_MASTER_KEY is missing from the environment.");
  }
  return Buffer.from(secret, "base64");
}

/** Encrypts plaintext, returns a base64-encoded string ready to store in the database. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Concatenates iv + authTag + ciphertext: none of the three is secret on
  // its own, only the master key is.
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypts a string produced by encrypt(). Throws if the master key doesn't match
 *  or if the ciphertext has been tampered with (AES-GCM's built-in protection). */
export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, getMasterKey(), iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
