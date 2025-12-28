import * as crypto from 'crypto';

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
