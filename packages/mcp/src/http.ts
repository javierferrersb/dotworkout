import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { buildServer, type ServerOptions } from "./server.js";

/**
 * The server over Streamable HTTP, for clients that cannot spawn a process: a
 * phone, ChatGPT, claude.ai.
 *
 * create_workout cannot write a file here: the disk this runs on is not the one
 * next to the caller's phone. It hands back a link instead — the workout
 * travels inside it, so opening it on a phone loads the composer with the
 * workout ready to download, and nothing is uploaded on the way.
 *
 * One server per request and nothing kept between them. The 2026-07-28
 * protocol has no sessions at all, and 2025-era clients are served the
 * established stateless way, so there is no state that could leak one caller's
 * workout into another's.
 */
export type HttpOptions = Omit<ServerOptions, "local">;

export function createHandler(options: HttpOptions): McpHttpHandler {
  // Every tool answers with a single result, so the default "auto" mode never
  // opens a stream; it answers with plain JSON.
  return createMcpHandler(() => buildServer({ site: options.site }));
}

const handlers = new Map<string, McpHttpHandler>();

/** Serves one request. Kept for callers of 0.5, which took the site per call. */
export async function handle(request: Request, options: HttpOptions): Promise<Response> {
  let handler = handlers.get(options.site);
  if (handler === undefined) {
    handler = createHandler(options);
    handlers.set(options.site, handler);
  }
  return handler.fetch(request);
}
