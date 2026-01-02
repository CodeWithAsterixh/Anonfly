import { v4 as uuidv4 } from 'uuid';
import { challengeStore } from '../../../lib/helpers/sessionStore';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';

import { validate, challengeSchema } from '../../../lib/helpers/validation';
import { authLimiter } from '../../../lib/middlewares/rateLimiter';

const challengeRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/auth/challenge',
  middleware: [authLimiter, validate(challengeSchema)],
  handler: withErrorHandling(async (event) => {
    const { body } = event;
    const { aid } = body as { aid: string };

    if (!aid) {
      return {
        message: 'AID is required',
        statusCode: 400,
        success: false,
        status: 'bad',
      };
    }

    const nonce = uuidv4();
    await challengeStore.set(aid, nonce);

    return {
      message: 'Challenge generated',
      statusCode: 200,
      success: true,
      status: 'good',
      data: { nonce },
    };
  }),
};

export default challengeRoute;
