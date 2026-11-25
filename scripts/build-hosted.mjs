import { build } from "vite";
import { cp, mkdir, readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const types = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",
  ".mp3":"audio/mpeg",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf",".png":"image/png",".svg":"image/svg+xml",
  ".txt":"text/plain; charset=utf-8",".md":"text/plain; charset=utf-8"};
const assets = {};
const notices=(await readdir("dist/licenses/pixelfx")).map(name => "licenses/pixelfx/"+name);
for (const file of ["index.html",...notices,...(await readdir("dist/assets")).map(name => "assets/"+name)]) {
  let bytes = await readFile(join("dist",file));
  if (file === "index.html") bytes = Buffer.from(bytes.toString().replace("<head>",'<head><meta name="battle-online" content="/">'));
  assets["/"+file] = {type:types[extname(file)] ?? "application/octet-stream",data:bytes.toString("base64")};
}
await build({
  configFile:false, publicDir:false,
  plugins:[{name:"game-assets",resolveId(id){ if(id==="virtual:battle-assets") return "\0"+id; },
    load(id){ if(id==="\0virtual:battle-assets") return "export default "+JSON.stringify(assets); }}],
  build:{outDir:"dist/server",target:"es2022",lib:{entry:"server/site-worker.ts",formats:["es"],fileName:()=>"index.js"},
    minify:true,reportCompressedSize:false},
});
await mkdir("dist/.openai",{recursive:true});
await cp(".openai/hosting.json","dist/.openai/hosting.json");
await cp("drizzle","dist/.openai/drizzle",{recursive:true});
