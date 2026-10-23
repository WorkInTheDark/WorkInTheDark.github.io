// Runs the leaderboard locally for testing, with an in-memory store and the game from this checkout
// (tools/phd-sim/out/data.json: run export-data.rb first). The dev page (tools/phd-sim/dev/) uses it.
//   node tools/phd-sim/leaderboard/dev-server.mjs [port=8790]
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
process.env.PHDSIM_SITE = process.env.PHDSIM_SITE || pathToFileURL(repo).href;
process.env.PHDSIM_DATA = process.env.PHDSIM_DATA || pathToFileURL(join(repo, "tools", "phd-sim", "out", "data.json")).href;
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "http://127.0.0.1:8766,http://localhost:8766,http://127.0.0.1:4000,http://localhost:4000";
process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN || "local-admin-token-0000";

const routes = {
  "/api/board": (await import("./api/board.js")).default,
  "/api/submit": (await import("./api/submit.js")).default,
  "/api/admin": (await import("./api/admin.js")).default
};
const port = Number(process.argv[2]) || 8790;
createServer(function (req, res) {
  const route = routes[new URL(req.url, "http://x").pathname];
  if (!route) { res.statusCode = 404; res.end("not found"); return; }
  Promise.resolve(route(req, res)).catch(function (e) { console.error(e); res.statusCode = 500; res.end(); });
}).listen(port, "127.0.0.1", function () {
  console.log("PhD Simulator leaderboard (in memory) on http://127.0.0.1:" + port + " — game from " + process.env.PHDSIM_SITE);
});
