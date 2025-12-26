import withErrorHandling from "../../lib/middlewares/withErrorHandling.ts";
import projectDescription from "../../lib/constants/project_description.json" with { type: 'json' };
import { RouteConfig } from "../../types/index.js";

const homeRoute: Omit<RouteConfig, 'app'> = {
  method: "get",
  path: "/",
  handler: withErrorHandling(async () => {
    return {
      message: "Anonfly API - Welcome!",
      statusCode: 200,
      success: true,
      status: "good",
      data: projectDescription,
    };
  }),
};

export default homeRoute;