/** Local-only API guard. Next can normalize request.url to localhost even when
 * the user opened 127.0.0.1, so compare the browser origin to the actual Host.
 * Non-loopback hosts are rejected to avoid accepting rebinding/proxy origins.
 */
export function isLocalRequest(request:Request) {
  const host=request.headers.get("host")?.toLowerCase();
  if(!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))return false;
  const origin=request.headers.get("origin");
  if(!origin)return true;
  try {const parsed=new URL(origin);return ["http:","https:"].includes(parsed.protocol)&&parsed.host.toLowerCase()===host;}
  catch{return false;}
}
