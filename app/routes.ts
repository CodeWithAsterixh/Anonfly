import {
  type RouteConfig,
  layout,
  route
} from "@react-router/dev/routes";

export default [
  
   route('/login', 'routes/LoginPage.tsx'),
   route('/register', 'routes/RegisterPage.tsx'),

  layout("routes/ChatLayout.tsx", [
    {
      path: "/",
      file: "routes/home.tsx",
    },
    {
      path: "/:chatroomId",
      file: "routes/ChatRoomPage.tsx",
    },
  ]),
] satisfies RouteConfig;

