/* Starts the API (port 3001) and the web app (port 5173) together. */
const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const children = [];

function run(name, command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: "inherit" });
  child.on("exit", (code) => {
    console.log("[" + name + "] exited with code " + code);
    shutdown(code || 0);
  });
  children.push(child);
}

let closing = false;
function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("api", process.execPath, [path.join(root, "apps/api/src/server.js")], root);
run(
  "web",
  process.execPath,
  [require.resolve("vite/bin/vite.js", { paths: [path.join(root, "apps/web"), root] })],
  path.join(root, "apps/web")
);
