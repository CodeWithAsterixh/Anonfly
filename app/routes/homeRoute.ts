import withErrorHandling from "../../lib/middlewares/withErrorHandling";
import projectDescription from "../../lib/constants/project_description.json";
import type { RouteConfig } from "../../types";

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