import { AccessError, hasJudgeSession, reserveJudgeRun } from "@/lib/judge-access";
import { boundedForm } from "@/lib/bounded-form";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isLocalRequest } from "@/lib/local-request";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { workflowSchema } from "@/lib/workflow";

export const runtime = "nodejs";
export const maxDuration = 900;
export async function POST(request: Request) {
  const local=isLocalRequest(request);
  if (!local && !hasJudgeSession(request))
    return Response.json({error: "Enter a valid reviewer code to start a live analysis."}, {status: 403});
  if (!process.env.MODEL_API_KEY)
    return Response.json({error: "Meta API is not configured. Set MODEL_API_KEY in web/.env.local and restart the app."}, {status: 503});
  let temporaryRun:string|undefined;
  let accepted=false;
  try {
    const form = await boundedForm(request,local?106*1024*1024:28*1024*1024);
    const video = form.get("video");
    const task = String(form.get("task") || "").trim();
    const scope = String(form.get("scope") || "").trim();
    const refs = form.getAll("references");
    const transcript = form.get("transcript");
    if (transcript && (!(transcript instanceof File) || !/\.(txt|md)$/i.test(transcript.name) || transcript.size > 480000))
      return Response.json({error: "Use a text or Markdown transcript under 480 KB."}, {status: 400});
    if (!(video instanceof File) || !video.name.toLowerCase().endsWith(".mp4") ||
        video.size < 1 || video.size > (local?100:25) * 1024 * 1024 || !task || task.length > 8000 || scope.length > 8000)
      return Response.json({error: "Add a task description and an MP4 video within the displayed size limit."}, {status: 400});
    if (refs.length > 10 || refs.some(file => !(file instanceof File) || !/\.(txt|md)$/i.test(file.name) || file.size > 480000))
      return Response.json({error: "Use up to 10 text or Markdown reference excerpts, each under 480 KB."}, {status: 400});
    const root = path.resolve(process.cwd(), "..");
    const runDir = path.join(root, ".unwritten-runs", randomUUID());
    if(!local)temporaryRun=runDir;
    await mkdir(runDir, {recursive: true});
    const videoPath = path.join(runDir, "source.mp4");
    await writeFile(videoPath, Buffer.from(await video.arrayBuffer()));
    if(!local) {
      let stdout:string;
      try {({stdout}=await promisify(execFile)("ffprobe",["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",videoPath],{timeout:10000}));}
      catch {throw new AccessError("Use a valid MP4 up to two minutes. No run was used.",400);}
      const duration=Number(stdout.trim());
      if(!Number.isFinite(duration)||duration<=0||duration>120)return Response.json({error:"Reviewer videos must be valid MP4s no longer than two minutes. No run was used."},{status:400});
      await reserveJudgeRun(request,request.headers.get("x-analysis-id")||""); accepted=true;
    }
    const references: string[] = [];
    for (const [index, raw] of refs.entries()) {
      const file = raw as File;
      const refPath = path.join(runDir, `reference-${index + 1}${path.extname(file.name).toLowerCase()}`);
      await writeFile(refPath, Buffer.from(await file.arrayBuffer()));
      references.push(refPath);
    }
    let transcriptPath: string | undefined;
    if (transcript instanceof File) {
      transcriptPath = path.join(runDir, "transcript.txt");
      await writeFile(transcriptPath, Buffer.from(await transcript.arrayBuffer()));
    }
    const input = {transcript: transcriptPath, video: videoPath, source: video.name, task, scope, references,
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
  } catch (error) {
    if(error instanceof RangeError)return Response.json({error:"The upload exceeds this deployment’s size limit. No reviewer run was used."},{status:413});
    if(error instanceof AccessError)return Response.json({error:error.message},{status:error.status});
    return Response.json({error: local?"Analysis could not finish. Check Meta access and the Python environment. Local run files are retained in .unwritten-runs.":accepted?"The accepted analysis could not finish; one reviewer run was used. Earlier results remain in your browser.":"The upload could not be accepted. No reviewer run was used. Check the MP4 and size limit."}, {status: 500});
  } finally {if(temporaryRun)await rm(temporaryRun,{recursive:true,force:true}).catch(()=>{});}
}
