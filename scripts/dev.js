import { spawn } from "node:child_process";
import { createConnection } from "node:net";

const children = [["web", "npm run dev:web"]];
if (await isPortOpen(8787)) {
  console.log("api already listening on http://127.0.0.1:8787");
} else {
  children.unshift(["api", "npm run server"]);
}

const processes = children.map(([name, command]) => {
  const child = spawn(command, {
    stdio: "inherit",
    shell: true,
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

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}
