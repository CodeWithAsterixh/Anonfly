/**
 * Represents pagination details for paginated responses.
 */
type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

import { Request, Response, NextFunction } from 'express';

export interface RouteEvent {
  req: Request & { userAid?: string; username?: string; session?: any };
  res: Response;
  next: NextFunction;
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
  headers: Record<string, any>;
  rawBody?: Buffer;
}

interface ErrorHandlingOptions {
  skipProcesses?: Array<'connectionActivity'>;
}

interface generalResponse {
  message: string;
  statusCode: number;
  success: boolean;
  status: "good" | "bad";
  connectionActivity?: "online" | "offline";
}

type AppOrRouter = import('express').Application | import('express').Router;

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'all';

type RequestHandler = import('express').RequestHandler;

interface RouteConfig<ReturnT = {}> {
  app?: AppOrRouter;
  method: HttpMethod;
  path: string;
  middleware?: RequestHandler[];
  handler: (event: RouteEvent) => Promise<Partial<generalResponse> & ReturnT>;
}


/**
 * A utility type that represents all possible dot-notation key paths of a nested object `T`.
 * Excludes arrays, functions, and built-in object prototypes like strings and dates.
 */
type DotNestedKeys<T> = T extends object
  ? {
      [K in Extract<keyof T, string>]: NonPlainObject<T[K]> extends true
        ? K
        : K | `${K}.${DotNestedKeys<T[K]>}`;
    }[Extract<keyof T, string>]
  : never;

/**
 * Helper type that returns true if `T` is not a plain object (e.g., string, array, function).
 */
type NonPlainObject<T> = T extends
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Function
  | Date
  | any[]
  ? true
  : false;
