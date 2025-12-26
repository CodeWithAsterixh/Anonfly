import withErrorHandling from "../../lib/middlewares/withErrorHandling.ts";
import type { RouteConfig } from "../../types/index.d.ts";

const healthzRoute: Omit<RouteConfig, 'app'> = {
  method: "get",
  path: "/healtz",
  handler: withErrorHandling(async () => {
    return {
      message: "OK",
      statusCode: 200,
      success: true,
      status: "good",
    };
  }),
};

export default healthzRoute;