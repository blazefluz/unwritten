import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { workflowSchema } from "@/lib/workflow";

export const runtime = "nodejs";
export const maxDuration = 900;
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({error: "Open the app locally to start an analysis."}, {status: 403});
  if (!process.env.MODEL_API_KEY)
    return Response.json({error: "Meta API is not configured. Set MODEL_API_KEY in web/.env.local and restart the app."}, {status: 503});
  try {
    const form = await request.formData();
    const video = form.get("video");
    const task = String(form.get("task") || "").trim();
    const scope = String(form.get("scope") || "").trim();
    const refs = form.getAll("references");
    if (!(video instanceof File) || !video.name.toLowerCase().endsWith(".mp4") ||
        video.size < 1 || video.size > 100 * 1024 * 1024 || !task || task.length > 8000 || scope.length > 8000)
      return Response.json({error: "Add a task description and an MP4 video under 100 MB."}, {status: 400});
    if (refs.length > 10 || refs.some(file => !(file instanceof File) || !/\.(txt|md)$/i.test(file.name) || file.size > 480000))
      return Response.json({error: "Use up to 10 text or Markdown reference excerpts, each under 480 KB."}, {status: 400});
    const root = path.resolve(process.cwd(), "..");
    const runDir = path.join(root, ".unwritten-runs", randomUUID());
    await mkdir(runDir, {recursive: true});
    const videoPath = path.join(runDir, "source.mp4");
    await writeFile(videoPath, Buffer.from(await video.arrayBuffer()));
    const references: string[] = [];
    for (const [index, raw] of refs.entries()) {
      const file = raw as File;
      const refPath = path.join(runDir, `reference-${index + 1}${path.extname(file.name).toLowerCase()}`);
      await writeFile(refPath, Buffer.from(await file.arrayBuffer()));
      references.push(refPath);
    }
    const input = {video: videoPath, source: video.name, task, scope, references,
      observations: path.join(runDir, "observations.json"), output: path.join(runDir, "workflow.json")};
    const result = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.env.UNWRITTEN_PYTHON || path.join(root, ".venv/bin/python"),
        ["-m", "unwritten.web_bridge"], {cwd: root, env: process.env, stdio: ["pipe", "pipe", "pipe"]});
      let output = "";
      const timer = setTimeout(() => {child.kill(); reject(new Error("timeout"));}, 900000);
      child.stdout.on("data", data => {output += data.toString(); if (output.length > 10_000_000) child.kill();});
      child.stderr.on("data", () => {});
      child.on("error", error => {clearTimeout(timer); reject(error);});
      child.on("close", code => {clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error("analysis"));});
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(input));
    });
    return Response.json(workflowSchema.parse(JSON.parse(result)));
  } catch {
    return Response.json({error: "Analysis could not finish. Check Meta billing, credits, API access, and the Python environment. Local run files are retained in .unwritten-runs."}, {status: 500});
  }
}
