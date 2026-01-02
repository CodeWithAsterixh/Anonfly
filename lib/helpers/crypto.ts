import * as crypto from 'crypto';
import env from '../constants/env';

const ENCRYPTION_KEY = crypto.scryptSync(env.JWT_ACCESS_SECRET || 'default-secret', 'salt', 32);
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts a string using AES-256-CBC.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string using AES-256-CBC.
 */
export function decrypt(text: string): string {
  const [ivHex, encryptedText] = text.split(':');
  if (!ivHex || !encryptedText) throw new Error('Invalid encrypted text format');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generates a short-lived authorization token for joining a room.
 * This token is issued after a share link is validated.
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
export function generateRoomAccessToken(roomId: string, password?: string): string {
  const payload = JSON.stringify({
    roomId,
    password: password || null,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours expiry
  });
  return encrypt(payload);
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
 * @param message The message that was signed (as a string or Buffer).
 * @param signature The signature (Base64 encoded).
 * @param publicKey The public key (Base64 DER encoded).
 * @returns boolean
 */
export function verifySignature(message: string | Buffer, signature: string, publicKey: string): boolean {
  try {
    const sigBuffer = Buffer.from(signature, 'base64');
    const keyBuffer = Buffer.from(publicKey, 'base64');
    
    // Ed25519 public key in DER format starts with a specific prefix.
    // If it's just the raw 32-byte key, we might need to handle that.
    // Assuming it's DER format as exported by SubtleCrypto.
    
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
