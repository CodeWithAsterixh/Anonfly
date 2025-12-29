import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { challengeStore, sessionStore } from '../../../lib/helpers/sessionStore';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';

const verifyRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/auth/verify',
  handler: withErrorHandling(async (event) => {
    const { body } = event;
    const { aid, signature, username, publicKey, exchangePublicKey } = body as {
      aid: string;
      signature: string;
      username: string;
      publicKey: string;
      exchangePublicKey: string;
    };

    if (!aid || !signature || !username || !publicKey || !exchangePublicKey) {
      return {
        message: 'Missing required fields',
        statusCode: 400,
        success: false,
        status: 'bad',
      };
    }

    const nonce = await challengeStore.get(aid);
    if (!nonce) {
      return {
        message: 'Challenge expired or not found',
        statusCode: 400,
        success: false,
        status: 'bad',
      };
    }

    // Verify signature
    try {
      // Identity Public Key is expected to be in PEM format or DER buffer
      // For this implementation, we assume the client sends the public key as a base64 encoded DER
      const pubKeyBuffer = Buffer.from(publicKey, 'base64');
      const signatureBuffer = Buffer.from(signature, 'base64');
      const nonceBuffer = Buffer.from(nonce, 'utf8');

      const isVerified = crypto.verify(
        undefined, // algorithm is inferred from key type
        nonceBuffer,
        {
          key: pubKeyBuffer,
          format: 'der',
          type: 'spki',
        },
        signatureBuffer
      );

      if (!isVerified) {
        return {
          message: 'Signature verification failed',
          statusCode: 401,
          success: false,
          status: 'bad',
        };
      }

      // Cleanup challenge
      await challengeStore.delete(aid);

      // Create session
      const token = uuidv4();
      await sessionStore.set(token, {
        aid,
        username,
        publicKey,
        exchangePublicKey,
      });

      return {
        message: 'Handshake successful',
        statusCode: 200,
        success: true,
        status: 'good',
        data: { token, aid, username },
      };
    } catch (error: any) {
      return {
        message: `Verification error: ${error.message}`,
        statusCode: 500,
        success: false,
        status: 'bad',
      };
    }
  }),
};

export default verifyRoute;
