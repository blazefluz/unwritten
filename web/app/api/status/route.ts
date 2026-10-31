export async function GET() {
  return Response.json({ ready: Boolean(process.env.MODEL_API_KEY) });
}
