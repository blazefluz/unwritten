import { spawn } from "node:child_process";
import path from "node:path";
export async function runPython(input: unknown): Promise<unknown> {
  const root = path.resolve(process.cwd(), "..");
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.UNWRITTEN_PYTHON || path.join(root, ".venv/bin/python"),
      ["-m", "unwritten.web_bridge"], {cwd: root, env: process.env, stdio: ["pipe", "pipe", "pipe"]});
    let output = "";
    const timer = setTimeout(() => {child.kill(); reject(new Error("timeout"));}, 900000);
    child.stdout.on("data", data => {output += data.toString(); if (output.length > 10_000_000) {child.kill(); reject(new Error("output limit"));}});
    child.stderr.on("data", () => {});
    child.on("error", error => {clearTimeout(timer); reject(error);});
    child.on("close", code => {clearTimeout(timer); if (code !== 0) reject(new Error("analysis"));
      else {try {resolve(JSON.parse(output));} catch {reject(new Error("invalid output"));}}});
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(input));
  });
}
