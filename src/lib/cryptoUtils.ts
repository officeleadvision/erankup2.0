import crypto from "crypto";

const ENV_ENCRYPTION_KEY = process.env.FEEDBACK_ENCRYPTION_KEY;

const PWD_KEY = ENV_ENCRYPTION_KEY || "ItmZILUr4D";
const TARGET_ALGORITHM = "aes-256-cbc";

function deriveKeyAndIv(passwordString: string): { key: Buffer; iv: Buffer } {
  const passwordBuffer = Buffer.from(passwordString, "utf8");
  const keyLenBytes = 32;
  const ivLenBytes = 16;

  let M_parts: Buffer[] = [];
  let D_prev = Buffer.alloc(0);

  let accumulatedLength = 0;
  while (accumulatedLength < keyLenBytes + ivLenBytes) {
    const concatBuffer = Buffer.concat([D_prev, passwordBuffer]);
    const D_cur: Buffer = crypto
      .createHash("md5")
      .update(concatBuffer)
      .digest();
    M_parts.push(D_cur);
    accumulatedLength += D_cur.length;
    D_prev = D_cur as any;
  }

  const M = Buffer.concat(M_parts);
  const key = M.subarray(0, keyLenBytes);
  const iv = M.subarray(keyLenBytes, keyLenBytes + ivLenBytes);
  return { key, iv };
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
  } catch (error) {
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
  } catch (error) {
    return "[Decryption Error]";
  }
}
