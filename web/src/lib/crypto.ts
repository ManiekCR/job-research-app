import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // taille recommandée pour AES-GCM
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_MASTER_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_MASTER_KEY est manquante dans l'environnement.");
  }
  return Buffer.from(secret, "base64");
}

/** Chiffre un texte en clair, renvoie une chaîne encodée en base64 prête à stocker en base. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // On concatène iv + authTag + texte chiffré : aucun des trois n'est secret
  // individuellement, seule la clé maître l'est.
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Déchiffre une chaîne produite par encrypt(). Lève une erreur si la clé maître ne correspond pas
 *  ou si le texte chiffré a été altéré (protection intégrée d'AES-GCM). */
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