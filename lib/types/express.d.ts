import { Request } from 'express';
import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: Types.ObjectId;
        // Add other user properties if they are expected to be on req.user
      };
    }
  }
}
