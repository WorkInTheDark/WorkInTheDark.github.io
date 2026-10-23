// Cleaning up the leaderboard. Players are named by the short id the board shows for them
// (each entry's "pub", visible in /api/board).
//   BOARD_URL=https://<your-project>.vercel.app ADMIN_TOKEN=... node tools/phd-sim/leaderboard/admin.mjs <command>
//     list [all | daily [YYYY-MM-DD]]    show a board with each player's id
//     remove <id>                         take a player off every board
//     ban <id> / unban <id>               remove and block further submissions / allow them again
//     rename <id> "<new nickname>"        replace a nickname ("" for anonymous)
const base = (process.env.BOARD_URL || "").replace(/\/$/, "");
const token = process.env.ADMIN_TOKEN || "";
const [cmd, a, b] = process.argv.slice(2);
if (!base) { console.error("Set BOARD_URL (and ADMIN_TOKEN for changes)."); process.exit(1); }

if (cmd === "list" || !cmd) {
  const kind = a === "daily" ? "daily" : "all";
  const r = await (await fetch(base + "/api/board?kind=" + kind + (b ? "&day=" + b : "") + "&limit=100")).json();
  console.log((kind === "daily" ? "Daily " + r.day : "All time") + ": " + r.total + " players");
  for (const e of r.entries) console.log(String(e.rank).padStart(3) + "  " + e.pub + "  " + String(e.score).padStart(6) + "  " + (e.nick || "(anonymous)") + "  " + e.ending + "  " + e.at.slice(0, 10));
} else if (["remove", "ban", "unban", "rename"].indexOf(cmd) >= 0 && a) {
  const r = await fetch(base + "/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: cmd, pub: a, nick: b }) });
  console.log(r.status, await r.text());
} else {
  console.error("Usage: list [all|daily [day]] | remove <id> | ban <id> | unban <id> | rename <id> \"<nickname>\"");
  process.exit(1);
}
