
import { describe, expect, test } from '@jest/globals';
import {
  encrypt,
  decrypt,
  generateJoinAuthToken,
  validateJoinAuthToken,
  generateRoomAccessToken,
  validateRoomAccessToken,
  verifySignature
} from './crypto';
import * as crypto from 'node:crypto';

describe('Crypto Helper Tests', () => {
  
  describe('Encryption/Decryption', () => {
    test('should encrypt and decrypt a string correctly', () => {
      const originalText = 'This is a secret message';
      const encrypted = encrypt(originalText);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    test('should fail to decrypt tampered data', () => {
      const originalText = 'Secret';
      const encrypted = encrypt(originalText);
      // Decode, flip a bit, encode back
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] = buffer[buffer.length - 1] ^ 1; // Flip last bit
      const tampered = buffer.toString('base64');
      
      expect(() => decrypt(tampered)).toThrow();
    });

    test('should produce different ciphertexts for same plaintext (due to random IV)', () => {
      const text = 'Repeat me';
      const enc1 = encrypt(text);
      const enc2 = encrypt(text);
      expect(enc1).not.toBe(enc2);
      expect(decrypt(enc1)).toBe(text);
      expect(decrypt(enc2)).toBe(text);
    });
  });

  describe('Join Auth Token', () => {
    test('should generate a valid join auth token', () => {
      const roomId = 'room123';
      const userAid = 'user456';
      const token = generateJoinAuthToken(roomId, userAid);
      expect(validateJoinAuthToken(token, roomId, userAid)).toBe(true);
    });

    test('should reject token for wrong room', () => {
      const roomId = 'room123';
      const userAid = 'user456';
      const token = generateJoinAuthToken(roomId, userAid);
      expect(validateJoinAuthToken(token, 'wrongRoom', userAid)).toBe(false);
    });

    test('should reject token for wrong user', () => {
      const roomId = 'room123';
      const userAid = 'user456';
      const token = generateJoinAuthToken(roomId, userAid);
      expect(validateJoinAuthToken(token, roomId, 'wrongUser')).toBe(false);
    });
    
    // Cannot easily test expiration without mocking Date.now(), skipping for now
  });

  describe('Room Access Token', () => {
    test('should generate and validate room access token', () => {
      const roomId = 'roomABC';
      const { token, expiresAt } = generateRoomAccessToken(roomId);
      const result = validateRoomAccessToken(token);
      expect(result.roomId).toBe(roomId);
      expect(result.password).toBeUndefined();
      expect(expiresAt).toBeGreaterThan(Date.now());
    });

    test('should handle password in room access token', () => {
      const roomId = 'roomABC';
      const password = 'hashedPassword123';
      const { token } = generateRoomAccessToken(roomId, password);
      const result = validateRoomAccessToken(token);
      expect(result.roomId).toBe(roomId);
      expect(result.password).toBe(password);
    });

    test('should throw on invalid token', () => {
        expect(() => validateRoomAccessToken('invalid-base64')).toThrow();
    });
  });

  describe('Signature Verification', () => {
    test('should verify valid signature', () => {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
        const message = 'Signed Message';
        const signature = crypto.sign(null, Buffer.from(message), privateKey);
        
        const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
        const signatureB64 = signature.toString('base64');

        expect(verifySignature(message, signatureB64, publicKeyB64)).toBe(true);
    });

    test('should reject invalid signature', () => {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
        const message = 'Signed Message';
        // Sign a different message
        const signature = crypto.sign(null, Buffer.from('Other Message'), privateKey);
        
        const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
        const signatureB64 = signature.toString('base64');

        expect(verifySignature(message, signatureB64, publicKeyB64)).toBe(false);
    });

    test('should reject invalid public key', () => {
        const message = 'msg';
        const signature = 'c2ln'; // dummy
        const publicKey = 'invalid-key';
        expect(verifySignature(message, signature, publicKey)).toBe(false);
    });
  });

});
