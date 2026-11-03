import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";

export const JUDGE_RUN_LIMIT = 6;
const cookieName = "unwritten_reviewer";
const lifetime = 2 * 60 * 60;
let pool: Pool | undefined;
let schema: Promise<void> | undefined;
export class AccessError extends Error {
  status:number;
  constructor(message:string,status=403) {super(message);this.status=status;}
}
export function judgeConfigured() {
  return process.env.JUDGE_LIVE_ENABLED === "true" &&
    (process.env.JUDGE_ACCESS_CODE?.length || 0) >= 24 &&
    !!process.env.DATABASE_URL && !!process.env.MODEL_API_KEY;
}
export function sameSite(request:Request) {
  try {
    const target = new URL(process.env.RENDER_EXTERNAL_URL || `${new URL(request.url).protocol}//${request.headers.get("host") || ""}`);
    const origin = request.headers.get("origin");
    return !!origin && new URL(origin).origin === target.origin;
  } catch {return false;}
}
function secret() {return process.env.JUDGE_ACCESS_CODE || "";}
function digest(value:string) {return createHash("sha256").update(value).digest("hex");}
function equal(left:string,right:string) {
  const a=Buffer.from(left),b=Buffer.from(right);
  return a.length===b.length && timingSafeEqual(a,b);
}
function signature(value:string) {return createHmac("sha256",secret()).update(value).digest("hex");}
export function sessionToken(now=Date.now()) {
  const expires=String(Math.floor(now/1000)+lifetime);
  return `${expires}.${signature(expires)}`;
}
export function hasJudgeSession(request:Request,now=Date.now()) {
  if(!judgeConfigured())return false;
  const cookie=request.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith(cookieName+"="));
  const [expires,mac,...extra]=(cookie?.slice(cookieName.length+1)||"").split(".");
  const expiry=Number(expires);
  return extra.length===0 && /^\d+$/.test(expires||"") && !!mac &&
    expiry>Math.floor(now/1000) && expiry<=Math.floor(now/1000)+lifetime && equal(signature(expires),mac);
}
export function sessionCookie(request:Request,clear=false) {
  const secure=new URL(process.env.RENDER_EXTERNAL_URL||request.url).protocol==="https:"?"; Secure":"";
  return `${cookieName}=${clear?"":sessionToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear?0:lifetime}${secure}`;
}
function database() {
  if(!process.env.DATABASE_URL)throw new AccessError("Reviewer access is unavailable.",503);
  pool ||= new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});
  return pool;
}
async function tables() {
  schema ||= database().query(`CREATE TABLE IF NOT EXISTS unwritten_reviewer_grants (
    code_hash text PRIMARY KEY, used integer NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 6));
    CREATE TABLE IF NOT EXISTS unwritten_reviewer_runs (
      id uuid PRIMARY KEY, code_hash text NOT NULL REFERENCES unwritten_reviewer_grants(code_hash),
      accepted_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS unwritten_reviewer_attempts (
      bucket text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL);`).then(()=>{}).catch(e=>{schema=undefined;throw e;});
  await schema;
}
async function grant() {
  await tables();
  const key=digest(secret());
  await database().query("INSERT INTO unwritten_reviewer_grants(code_hash) VALUES($1) ON CONFLICT DO NOTHING",[key]);
  return key;
}
export async function remainingRuns() {
  const key=await grant();
  const {rows}=await database().query("SELECT used FROM unwritten_reviewer_grants WHERE code_hash=$1",[key]);
  return JUDGE_RUN_LIMIT-rows[0].used;
}
export async function verifyCode(request:Request,code:string) {
  if(!judgeConfigured())throw new AccessError("Live reviewer access is not configured yet.",503);
  if(!sameSite(request))throw new AccessError("Open this app directly to enter a reviewer code.");
  await tables();
  // Render appends the real client IP at the end of X-Forwarded-For. Store only a keyed digest.
  const ip=request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()||"unknown";
  const hour=Math.floor(Date.now()/3600000);
  const bucket=signature(`attempt:${ip}:${hour}`);
  const {rows}=await database().query(`INSERT INTO unwritten_reviewer_attempts(bucket,attempts,expires_at)
    VALUES($1,1,now()+interval '2 hours') ON CONFLICT(bucket) DO UPDATE SET attempts=unwritten_reviewer_attempts.attempts+1 RETURNING attempts`,[bucket]);
  await database().query("DELETE FROM unwritten_reviewer_attempts WHERE expires_at<now()");
  if(rows[0].attempts>10)throw new AccessError("Too many code attempts. Try again later.",429);
  if(!equal(digest(code),digest(secret())))throw new AccessError("That reviewer code is not valid.",401);
  const remaining=await remainingRuns();
  if(remaining===0)throw new AccessError("This code has used all six live runs and has expired.",410);
  return remaining;
}
export async function reserveJudgeRun(request:Request,id:string) {
  if(!sameSite(request)||!hasJudgeSession(request))throw new AccessError("Enter a valid reviewer code before starting a live analysis.");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new AccessError("Start a new analysis from the app.",400);
  const key=await grant(),client=await database().connect();
  try {
    await client.query("BEGIN");
    const {rows}=await client.query("SELECT used FROM unwritten_reviewer_grants WHERE code_hash=$1 FOR UPDATE",[key]);
    const duplicate=await client.query("SELECT id FROM unwritten_reviewer_runs WHERE id=$1",[id]);
    if(duplicate.rowCount)throw new AccessError("This analysis was already accepted. Do not submit it again.",409);
    if(rows[0].used>=JUDGE_RUN_LIMIT)throw new AccessError("This code has used all six live runs and has expired.",410);
    await client.query("INSERT INTO unwritten_reviewer_runs(id,code_hash) VALUES($1,$2)",[id,key]);
    await client.query("UPDATE unwritten_reviewer_grants SET used=used+1 WHERE code_hash=$1",[key]);
    await client.query("COMMIT");
    return {id,remaining:JUDGE_RUN_LIMIT-rows[0].used-1};
  } catch(e) {await client.query("ROLLBACK");throw e;} finally {client.release();}
}
export async function judgeStatus(request:Request) {
  const configured=judgeConfigured(),authorized=hasJudgeSession(request);
  const remaining=authorized?await remainingRuns():null;
  return {configured,authorized,remaining,limit:JUDGE_RUN_LIMIT,ready:authorized&&(remaining||0)>0};
}
export async function closeJudgeDatabase() {await pool?.end();pool=undefined;schema=undefined;}
