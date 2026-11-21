import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { build } from "vite";
import { matchService, publicGame } from "../server/published-site.ts";

const outDir = "dist-pages";
await build({
  base: publicGame.pathname,
  build: { outDir },
  plugins: [{
    name: "online-matches",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: "battle-online", content: matchService.origin }, injectTo: "head" }];
    },
  }],
});

// Each invite opens a real entry page even when a player follows it directly or reloads.
for (const route of ["room", "ffa"]) {
  await mkdir(join(outDir, route), { recursive: true });
  await copyFile(join(outDir, "index.html"), join(outDir, route, "index.html"));
}
