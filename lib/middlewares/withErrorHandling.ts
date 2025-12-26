
import type { ErrorHandlingOptions, generalResponse, RouteEvent } from '../../types/index.d.ts';
import { normalizeError } from "../helpers/normalizeError.ts";
import checkHttpConnectivity from "../helpers/ping.ts";

/**
 * Wraps an Express-style event handler with:
 *  - Internet‑connectivity check (via pingUrl())
 *  - Attaches isOnline to res.locals
 *  - Default JSON success or error envelope
 *
 * @template ReturnT
 * @param {(event: RouteEvent) => Promise<Partial<generalResponse> & ReturnT>} handler
 * @param {ErrorHandlingOptions} [options={}]
 * @returns {(event: RouteEvent) => Promise<Partial<generalResponse> & ReturnT>}
 */
export default function withErrorHandling<ReturnT>(handler: (event: RouteEvent) => Promise<Partial<generalResponse> & ReturnT>, options: ErrorHandlingOptions = {}): (event: RouteEvent) => Promise<Partial<generalResponse> & ReturnT> {
  return async function (event): Promise<Partial<generalResponse> & ReturnT> {
    const { res, req } = event;

    // 1. Connectivity check
    try {
      const online = await checkHttpConnectivity();
      const conn = online ? "online" : "offline";
      res.locals.isOnline = conn;

      if (
        conn === "offline" &&
        !options.skipProcesses?.includes("connectionActivity")
      ) {
        return {
          status: "bad",
          connectionActivity: "offline",
          statusCode: 503,
          success: false,
          message: "Service unavailable: cannot reach the internet.",
          ...( {} as ReturnT )
        };
      }
    } catch {
      res.locals.isOnline = "offline";
    }

    // 2. Execute handler and build envelope
    try {
      const data = await handler(event);
      return {
        message: "Request processed successfully",
        connectionActivity: res.locals.isOnline,
        statusCode: 200,
        success: true,
        status: "good",
        ...data,
      };
    } catch (err) {
      const { message, statusCode } = normalizeError(err);
      return {
        status: "bad",
        connectionActivity: res.locals.isOnline || "offline",
        statusCode,
        message,
        success: false,
        ...( {} as ReturnT )
      };
    }
  };
}
