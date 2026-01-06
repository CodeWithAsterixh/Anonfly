import * as crypto from 'crypto';
import env from '../constants/env';

const KEY_LENGTH = 32; // 256-bit
const IV_LENGTH = 12; // 96-bit nonce for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

// Generate a secure key from your secret
const ENCRYPTION_KEY = crypto.scryptSync(env.JWT_ACCESS_SECRET as string, env.SALT as string, KEY_LENGTH);
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts text using AES-256-GCM.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Return IV + authTag + ciphertext as base64
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts text using AES-256-GCM.
 */
export function decrypt(text: string): string {
  const data = Buffer.from(text, 'base64');
  const iv = data.slice(0, IV_LENGTH);
  const authTag = data.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.slice(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Generates a short-lived authorization token for joining a room.
 */
export function generateJoinAuthToken(roomId: string, userAid: string): string {
  const payload = JSON.stringify({
    roomId,
    userAid,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes expiry
    type: 'join_auth'
  });
  return encrypt(payload);
}

/**
 * Validates a join authorization token.
 */
export function validateJoinAuthToken(token: string, roomId: string, userAid: string): boolean {
  try {
    const decrypted = decrypt(token);
    const payload = JSON.parse(decrypted);
    return (
      payload.type === 'join_auth' &&
      payload.roomId === roomId &&
      payload.userAid === userAid &&
      payload.expiresAt > Date.now()
    );
  } catch (err) {
    return false;
  }
}

/**
 * Generates a signed token for room access.
 */
export function generateRoomAccessToken(roomId: string, password?: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours expiry
  const payload = JSON.stringify({
    roomId,
    password: password || null,
    expiresAt,
  });
  return {
    token: encrypt(payload),
    expiresAt,
  };
}

/**
 * Validates and decrypts a room access token.
 */
export function validateRoomAccessToken(token: string): { roomId: string; password?: string } {
  try {
    const decrypted = decrypt(token);
    const payload = JSON.parse(decrypted);

    if (payload.expiresAt < Date.now()) {
      throw new Error('Token expired');
    }

    return {
      roomId: payload.roomId,
      password: payload.password || undefined,
    };
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verifies an Ed25519 signature.
 */
export function verifySignature(message: string | Buffer, signature: string, publicKey: string): boolean {
  try {
    const sigBuffer = Buffer.from(signature, 'base64');
    const keyBuffer = Buffer.from(publicKey, 'base64');

    return crypto.verify(
      null,
      Buffer.from(message),
      {
        key: keyBuffer,
        format: 'der',
        type: 'spki',
      },
      sigBuffer
    );
  } catch (err) {
    return false;
  }
}
