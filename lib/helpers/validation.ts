import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const validate = (schema: z.ZodObject<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors,
        status: 'bad',
      });
    }
  };
};

export const chatroomSchema = z.object({
  body: z.object({
    roomname: z.string().min(3).max(50).trim(),
    description: z.string().max(200).trim().optional(),
    password: z.string().min(4).max(50).optional(),
    region: z.string().max(50).optional(),
    isPrivate: z.boolean().optional(),
  }),
});

export const joinChatroomSchema = z.object({
  body: z.object({
    chatroomId: z.string().min(1),
    password: z.string().optional(),
    username: z.string().min(2).max(30).trim(),
    linkToken: z.string().optional(),
  }),
});

export const verifyIdentitySchema = z.object({
  body: z.object({
    aid: z.string().min(10).max(100),
    publicKey: z.string().min(10),
    signature: z.string().min(10),
    username: z.string().min(2).max(30).trim(),
    exchangePublicKey: z.string().min(10),
  }),
});

export const challengeSchema = z.object({
  body: z.object({
    aid: z.string().min(10).max(100),
  }),
});
