import { spawn } from "node:child_process";
import { loadTestEnv } from "./e2e-env.mjs";

const env = loadTestEnv();
const [mode, ...args] = process.argv.slice(2);
const commands = {
  build: ["node_modules/next/dist/bin/next", "build"],
  test: ["node_modules/@playwright/test/cli.js", "test"],
  start: ["node_modules/next/dist/bin/next", "start", "-p", "3217"],
};
if (!commands[mode]) throw new Error("Expected build, start or test.");
const child = spawn(process.execPath, [...commands[mode], ...args], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
