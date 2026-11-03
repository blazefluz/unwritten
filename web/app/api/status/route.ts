export async function GET() {
  return Response.json({ demoOnly: process.env.UNWRITTEN_DEMO_ONLY === "true", ready: process.env.UNWRITTEN_DEMO_ONLY !== "true" && Boolean(process.env.MODEL_API_KEY) });
}
