import { authenticateAgent, controlBody, ingestOk } from "@/lib/workshop/ingest";

export const dynamic = "force-dynamic";

/** GET /api/agents/v1/control — what the owner wants: run, pause or stop. */
export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if ("response" in auth) return auth.response;
  return ingestOk(controlBody(auth.agent));
}
