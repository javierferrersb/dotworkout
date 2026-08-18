import { handle } from "@dotworkout/mcp/http";

/**
 * The MCP endpoint, served from the same deployment as the composer.
 *
 * It lives here rather than in its own project because it needs nothing of its
 * own: no storage, no session, no second domain. The workout it hands back
 * travels inside a link to the very site this is deployed alongside, so the two
 * are already the same origin, and a client that can reach one can reach both.
 *
 * Hobby includes 4 CPU-hours a month. A workout costs about 36 ms of it.
 */
export const config = { runtime: "nodejs" };

const SITE = process.env.DOTWORKOUT_SITE ?? "https://workout.javierferrersb.dev";

export default async function mcp(request: Request): Promise<Response> {
  if (request.method === "GET" && new URL(request.url).searchParams.has("health")) {
    return new Response("ok", { headers: { "content-type": "text/plain" } });
  }

  try {
    return await handle(request, { site: SITE });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
