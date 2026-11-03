import { judgeStatus } from "@/lib/judge-access";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const demoOnly=process.env.UNWRITTEN_DEMO_ONLY==="true";
  try {
    const judge=await judgeStatus(request);
    return Response.json({demoOnly,ready:demoOnly?judge.ready:Boolean(process.env.MODEL_API_KEY),judge},{headers:{"Cache-Control":"no-store"}});
  } catch {return Response.json({demoOnly,ready:false},{headers:{"Cache-Control":"no-store"}});}
}
