
import type { ErrorHandlingOptions, GeneralResponse, RouteEvent } from '../../types/index.d';
import { normalizeError } from "../helpers/normalizeError";
import checkHttpConnectivity from "../helpers/ping";

/**
 * Wraps an Express-style event handler with:
 *  - Internet‑connectivity check (via pingUrl())
 *  - Attaches isOnline to res.locals
 *  - Default JSON success or error envelope
 *
 * @template ReturnT
 * @param {(event: RouteEvent) => Promise<Partial<GeneralResponse> & ReturnT>} handler
 * @param {ErrorHandlingOptions} [options={}]
 * @returns {(event: RouteEvent) => Promise<Partial<GeneralResponse> & ReturnT>}
 */
export default function withErrorHandling<ReturnT>(handler: (event: RouteEvent) => Promise<Partial<GeneralResponse> & ReturnT>, options: ErrorHandlingOptions = {}): (event: RouteEvent) => Promise<Partial<GeneralResponse> & ReturnT> {
  return async function (event): Promise<Partial<GeneralResponse> & ReturnT> {
    const { res } = event;

    // 1. Connectivity check
    try {
      const online = await checkHttpConnectivity();
      const conn = online ? "online" : "offline";
      res.locals.isOnline = conn;

      if (
        conn === "offline" &&
        !options.skipProcesses?.includes("connectionActivity")
      ) {
        console.warn(`[Connectivity] Service unavailable: checkHttpConnectivity returned ${conn}`);
        // Return 200 instead of 503 if internet is unreachable, as it might be a false positive in some environments
        /*
        return {
          status: "bad",
          connectionActivity: "offline",
          statusCode: 503,
          success: false,
          message: "Service unavailable: cannot reach the internet.",
          ...( {} as ReturnT )
        };
        */
      }
    } catch (error) {
      console.error(`[Connectivity] Error during connectivity check:`, error);
      res.locals.isOnline = "offline";
    }

    // 2. Execute handler and build envelope
    try {
      const data = await handler(event);
      return {
        message: data.message || "Request processed successfully",
        connectionActivity: res.locals.isOnline,
        statusCode: data.statusCode || 200,
        success: data.success !== undefined ? data.success : true,
        status: data.status || "good",
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
