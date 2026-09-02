import { spawn } from "child_process";
import { createServer } from "net";

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port, "127.0.0.1");
  });
}

function run(cmd, args) {
  const p = spawn(cmd, args, { stdio: "inherit", shell: true });
  p.on("exit", (code) => { if (code && code !== 0) process.exit(code); });
  return p;
}

console.log("🚀 Starting backend (port 3001) + frontend (port 5173)...");

isPortFree(3001).then((free) => {
  if (free) {
    run("node", ["--openssl-legacy-provider", "server.js"]);
  } else {
    console.log("ℹ️  Port 3001 already in use — skipping backend start.");
  }
});

run("npx", ["vite", "dev"]);
