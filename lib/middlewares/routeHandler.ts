import chalk from "chalk";
import type {
  AppOrRouter,
  HttpMethod,
  RouteConfig,
  GeneralResponse
} from "../../types";

/**
 * Registers a route on an Express app or Router.
 *
 * @param {AppOrRouter} app - An Express app or router instance.
 * @returns {(config: Omit<RouteConfig, 'app'>) => void} - A function that accepts a route config (without the app).
 */
export default function useRouter(
  app: AppOrRouter
): <ReturnT>(config: Omit<RouteConfig<ReturnT>, "app">) => void {
  return (params) =>
    routeHandler({
      app,
      ...params,
    });
}
interface HasErrorProperties {
  status?: number;
  statusCode?: number;
  message?: string;
}

function isErrorWithProperties(error: unknown): error is HasErrorProperties {
  return typeof error === "object" && error !== null;
}
function isStream(value: any): value is { pipe: Function } {
  return value && typeof value.pipe === "function";
}
/**
 * If the handler returns a value (and hasn’t already responded),
 * we send it: JSON by default, or raw for Buffer/streams.
 *
 * If the handler throws, a structured JSON error is returned.
 *
 * @param {RouteConfig} config
 */
export function routeHandler<ReturnT>({
  app,
  method,
  path,
  middleware = [],
  handler,
}: RouteConfig<ReturnT>) {
  const verb = method.toLowerCase();
  if (typeof (app as any)[verb] !== "function") {
    throw new Error(`Invalid HTTP method "${method}" for route ${path}`);
  }

  (app as Record<HttpMethod, (...args: any[]) => void>)[verb as HttpMethod](
    path,
    ...middleware,
    async (req: any, res: any) => {
      const event = {
        req,
        res,
        next: () => { },
        params: req.params,
        query: req.query,
        body: req.body,
        headers: req.headers,
        rawBody: Buffer.isBuffer(req.body) ? req.body : undefined,
      };

      try {
        const result: Partial<GeneralResponse> & ReturnT = await handler(event);
        const action_path = chalk.gray.bold(`${path}`);
        const action_verb = chalk.white.bold(verb.toUpperCase());
        if (res.headersSent) return;

        if (
          result !== undefined &&
          result.statusCode !== undefined &&
          result.statusCode >= 200 &&
          result.statusCode <= 399
        ) {
          if (Buffer.isBuffer(result) || isStream(result)) {
            return res
              .status(result.statusCode || 200)
              .type("application/octet-stream")
              .send(result);
          } else {
            return res.status(result.statusCode || 200).json(result);
          }
        } else {
          console.error(`[RouteHandler] Error status ${result?.statusCode} for ${verb.toUpperCase()} ${path}:`, result);
          return res.status(result?.statusCode || 500).json({
            message: result?.message || "An unexpected error occurred",
            status: "bad",
            connectionActivity: res.locals.isOnline || "offline",
            statusCode: result?.statusCode || 500,
            success: false,
          });
        }
      } catch (error) {
        if (res.headersSent) return;

        let statusCode = 500;
        let message = "An unexpected error occurred";

        if (isErrorWithProperties(error)) {
          statusCode = error.status || error.statusCode || 500;
          message = error.message || "An unexpected error occurred";
        }

        console.error(`ERROR in ${verb.toUpperCase()} ${path}:`, error);

        return res.status(statusCode).json({
          status: "bad",
          connectionActivity: res.locals.isOnline || "offline",
          statusCode,
          message,
          success: false,
        });
      }
    }
  );
}
