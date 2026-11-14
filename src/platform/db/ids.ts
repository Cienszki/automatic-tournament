// Ids for new rows. Imported rows keep their Firestore id; new ones get 20 characters from the
// same alphabet, so old and new ids look alike and every old link keeps working (SCHEMA.md 1).

import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const ID_LENGTH = 20;
export const ID_PATTERN = /^[A-Za-z0-9]{20}$/;

/** A new random id. Rejection sampling keeps every character equally likely. */
export function newId(): string {
  let out = '';
  while (out.length < ID_LENGTH) {
    for (const byte of randomBytes(32)) {
      // 248 = 62 * 4: bytes above it would make the first characters more likely.
      if (byte < 248) out += ALPHABET[byte % 62];
      if (out.length === ID_LENGTH) break;
    }
  }
  return out;
}
