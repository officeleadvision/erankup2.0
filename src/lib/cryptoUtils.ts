import crypto from "crypto";

const ENV_ENCRYPTION_KEY = process.env.FEEDBACK_ENCRYPTION_KEY;

const PWD_KEY = ENV_ENCRYPTION_KEY || "ItmZILUr4D";
const TARGET_ALGORITHM = "aes-256-cbc";

/**
 * OpenSSL EVP_BytesToKey (MD5, no salt) — kept for compatibility with the
 * existing encrypted records in the database. Do not change.
 */
function deriveKeyAndIv(passwordString: string): { key: Buffer; iv: Buffer } {
  const passwordBuffer = Buffer.from(passwordString, "utf8");
  const keyLenBytes = 32;
  const ivLenBytes = 16;

  const parts: Buffer[] = [];
  let previous: Buffer = Buffer.alloc(0);

  let accumulatedLength = 0;
  while (accumulatedLength < keyLenBytes + ivLenBytes) {
    const current: Buffer = crypto
      .createHash("md5")
      .update(Buffer.concat([previous, passwordBuffer]))
      .digest();
    parts.push(current);
    accumulatedLength += current.length;
    previous = current;
  }

  const material = Buffer.concat(parts);
  return {
    key: material.subarray(0, keyLenBytes),
    iv: material.subarray(keyLenBytes, keyLenBytes + ivLenBytes),
  };
}

const { key: DERIVED_KEY, iv: DERIVED_IV } = deriveKeyAndIv(PWD_KEY);

export function encrypt(text: string | null | undefined): string | null {
  if (text === null || text === undefined || text === "") {
    return null;
  }
  try {
    const cipher = crypto.createCipheriv(
      TARGET_ALGORITHM,
      DERIVED_KEY,
      DERIVED_IV
    );
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  } catch {
    return null;
  }
}

export function decrypt(
  encryptedText: string | null | undefined
): string | null {
  if (
    encryptedText === null ||
    encryptedText === undefined ||
    encryptedText === ""
  ) {
    return null;
  }
  try {
    const decipher = crypto.createDecipheriv(
      TARGET_ALGORITHM,
      DERIVED_KEY,
      DERIVED_IV
    );
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "[Decryption Error]";
  }
}
