import { boundedBytes } from "@/lib/bounded-form";
import { AccessError, judgeStatus, sessionCookie, sameSite, verifyCode } from "@/lib/judge-access";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request) {
  try{return Response.json(await judgeStatus(request),{headers});}
  catch{return Response.json({error:"Reviewer access is temporarily unavailable. Live runs remain locked."},{status:503,headers});}
}
export async function POST(request:Request) {
  if(!sameSite(request))return Response.json({error:"Open this app directly to enter a reviewer code."},{status:403,headers});
  try {
    if(Number(request.headers.get("content-length")||0)>2000)throw new AccessError("Code input is too large.",413);
    const raw=new TextDecoder().decode(await boundedBytes(request,2000));
    const {code}=JSON.parse(raw);if(typeof code!=="string"||code.length>200)throw new AccessError("Enter your reviewer code.",400);
    const remaining=await verifyCode(request,code.trim());
    return Response.json({authorized:true,remaining,limit:6},{headers:{...headers,"Set-Cookie":sessionCookie(request)}});
  } catch(e) {if(e instanceof RangeError)return Response.json({error:"Code input is too large."},{status:413,headers});return Response.json({error:e instanceof AccessError?e.message:"Reviewer access is unavailable. No run was used."},{status:e instanceof AccessError?e.status:503,headers});}
}
export async function DELETE(request:Request) {
  if(!sameSite(request))return Response.json({error:"Open this app directly."},{status:403,headers});
  return Response.json({authorized:false},{headers:{...headers,"Set-Cookie":sessionCookie(request,true)}});
}
