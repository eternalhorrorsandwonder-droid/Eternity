import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// Build-time manifest includes hashed JS/CSS/fonts as well as authored assets.
function offlineWorker() {
  return {
    name: "eternity-offline-worker",
    apply: "build",
    closeBundle() {
      const root = path.resolve("dist");
      const walk = (dir) =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
          const absolute = path.join(dir, entry.name);
          return entry.isDirectory()
            ? walk(absolute)
            : [path.relative(root, absolute).split(path.sep).join("/")];
        });
      const paths = walk(root)
        .filter((file) => file !== "sw.js")
        .sort();
      const hash = createHash("sha256");
      for (const file of paths) {
        hash.update(file);
        hash.update(fs.readFileSync(path.join(root, file)));
      }
      const version = hash.digest("hex").slice(0, 12),
        files = paths.map((file) => "./" + file);
      const worker = `const CACHE='eternity-vale-${version}';\nconst ASSETS=${JSON.stringify(["./", ...files])};\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));\nself.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('eternity-vale-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request,{ignoreVary:true}).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):Response.error())));});\n`;
      fs.writeFileSync(path.join(root, "sw.js"), worker);
    },
  };
}
export default defineConfig({
  plugins: [offlineWorker()],
  server: { host: "0.0.0.0", allowedHosts: true },
  preview: { host: "0.0.0.0", allowedHosts: true },
});
