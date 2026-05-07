import { spawn } from "node:child_process";

const children = [
  ["api", "node", ["server/index.js"]],
  ["web", "vite", ["--host", "127.0.0.1"]],
];

const isWindows = process.platform === "win32";
const processes = children.map(([name, command, args]) => {
  const child = spawn(isWindows ? `${command}.cmd` : command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`${name} exited${signal ? ` from ${signal}` : ` with code ${code}`}`);
    shutdown(code ?? 1);
  });

  return child;
});

let shuttingDown = false;

function shutdown(code = 0) {
  shuttingDown = true;
  processes.forEach((child) => {
    if (!child.killed) child.kill();
  });
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
