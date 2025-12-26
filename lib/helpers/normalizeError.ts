/**
 * Normalize any thrown value into message + statusCode.
 * @param  {unknown} err
 * @returns {{ message: string, statusCode: number }}
 */
export function normalizeError(err: unknown): { message: string; statusCode: number; } {
  let message = "Internal server error";
  let statusCode = 500;

  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === "string") {
    message = err;
  } else if (err && typeof err === "object") {
    const { message: m, statusCode: sc } = err as { message?: unknown; statusCode?: unknown };
    message = (typeof m === "string" && m) || message;
    statusCode = (typeof sc === "number" && sc) || statusCode;
  }

  return { message, statusCode };
}
