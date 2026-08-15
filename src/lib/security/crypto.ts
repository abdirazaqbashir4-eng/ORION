import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "@/lib/env";

/** Derives a fixed 32-byte AES key from ENCRYPTION_SECRET, whatever its length. */
function getKey(): Buffer {
  if (!env.ENCRYPTION_SECRET) {
    throw new Error("ENCRYPTION_SECRET is not set. Required to store OAuth tokens securely.");
  }
  return createHash("sha256").update(env.ENCRYPTION_SECRET).digest();
}

/** AES-256-GCM encrypt. Output is base64(iv | authTag | ciphertext). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
