import { defineConfig } from "vite";
import { attachRoom } from "./server/socket.ts";

export default defineConfig({
  plugins: [{
    name: "battle-rooms",
    configureServer(server) { if (server.httpServer) attachRoom(server.httpServer); },
    configurePreviewServer(server) { attachRoom(server.httpServer); },
  }],
});
