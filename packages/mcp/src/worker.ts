import { handle, type ServerOptions } from "./http.js";

/**
 * Cloudflare Workers entry point.
 *
 * Everything the server needs is in the request, so there is no storage
 * binding, no database and no session. That is what keeps it inside a free
 * isolate: the expensive half of validation — protovalidate and its CEL engine
 * — never loads, because the HTTP tools check the compatibility matrix against
 * the request instead of against a finished message.
 */
interface Env {
  readonly DOTWORKOUT_SITE?: string;
}

const DEFAULT_SITE = "https://workout.javierferrersb.dev";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not found. The MCP endpoint is /mcp.", { status: 404 });
    }

    const options: ServerOptions = { site: env.DOTWORKOUT_SITE ?? DEFAULT_SITE };
    try {
      return await handle(request, options);
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },
};
