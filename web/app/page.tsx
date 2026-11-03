import { readFile } from "node:fs/promises";
import path from "node:path";
import Workspace from "@/components/workspace";
import { workflowSchema } from "@/lib/workflow";
import { projectSchema, sessionSchema } from "@/lib/training";

export const dynamic = "force-dynamic";
export default async function Page() {
  const sample = workflowSchema.parse(JSON.parse(await readFile(
    path.resolve(process.cwd(), "../evaluation/zipper-pilot/workflow.json"), "utf-8")));
  const [cable, synthetic, measured] = await Promise.all([
    readFile(path.resolve(process.cwd(), "../examples/cable-training.project.json"), "utf-8"),
    readFile(path.resolve(process.cwd(), "../examples/synthetic-training.session.json"), "utf-8"),
    readFile(path.resolve(process.cwd(), "../evaluation/training-cable-final.session.json"), "utf-8"),
  ]);
  return <Workspace demoOnly={process.env.UNWRITTEN_DEMO_ONLY === "true"} initial={sample} guideExamples={{cableProject:projectSchema.parse(JSON.parse(cable)),syntheticSession:sessionSchema.parse(JSON.parse(synthetic)),cableSession:sessionSchema.parse(JSON.parse(measured))}} />;
}
