import { readFile } from "node:fs/promises";
import path from "node:path";
import Workspace from "@/components/workspace";
import { workflowSchema } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export default async function Page() {
  const sample = workflowSchema.parse(JSON.parse(await readFile(
    path.resolve(process.cwd(), "../examples/synthetic-workflow.json"), "utf-8")));
  return <Workspace initial={sample} />;
}
