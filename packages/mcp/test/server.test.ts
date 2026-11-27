import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decode } from "@dotworkout/codec";
import { readWorkoutLink, steps } from "@dotworkout/domain";
import { createHandler } from "../src/http.js";
import { SKILL_URI } from "../src/skill.js";
import { toAlertSpec } from "../src/workout.js";

const SITE = "https://workout.example.dev";
const handler = createHandler({ site: SITE });

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const NORWEGIAN = {
  activity: "RUNNING",
  name: "Norwegian 4×4",
  warmup: { time: "10min" },
  blocks: [
    {
      repeat: 4,
      work: { time: "4:00" },
      rest: "3:00",
      alert: { kind: "heartRateZone", zone: 4 },
    },
  ],
  cooldown: { time: "5min" },
};

let id = 0;

/** A 2026-07-28 request: no handshake, version and capabilities on every call. */
async function modern(method: string, params: Json = {}): Promise<Json> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": method,
  };
  const name = params["name"] ?? params["uri"];
  if (typeof name === "string") headers["mcp-name"] = name;

  const response = await handler.fetch(
    new Request(`${SITE}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++id,
        method,
        params: {
          ...params,
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
            "io.modelcontextprotocol/clientCapabilities": {
              extensions: { "io.modelcontextprotocol/skills": {} },
            },
          },
        },
      }),
    }),
  );
  const body = (await response.json()) as Json;
  assert.equal(body["error"], undefined, JSON.stringify(body["error"]));
  return body["result"] as Json;
}

/** A 2025-11-25 client, served statelessly: initialize, then its call. */
async function legacy(method: string, params: Json = {}): Promise<Json> {
  const post = (body: Json) =>
    handler.fetch(
      new Request(`${SITE}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
        },
        body: JSON.stringify(body),
      }),
    );
  const response = await post({ jsonrpc: "2.0", id: ++id, method, params });
  const text = await response.text();
  // A stateless 2025 server may answer as one SSE event.
  const json = text.startsWith("{") ? text : (/^data: (.*)$/m.exec(text)?.[1] ?? "{}");
  const body = JSON.parse(json) as Json;
  assert.equal(body["error"], undefined, JSON.stringify(body["error"]));
  return body["result"] as Json;
}

describe("2026-07-28 clients", () => {
  it("discover the skills extension and the instructions, with cache hints", async () => {
    const result = await modern("server/discover");
    assert.ok(result["supportedVersions"].includes("2026-07-28"));
    assert.ok("io.modelcontextprotocol/skills" in result["capabilities"]["extensions"]);
    assert.match(result["instructions"], /full link/);
    assert.match(result["instructions"], new RegExp(SKILL_URI.replace(/[/.]/g, "\\$&")));
    assert.equal(typeof result["ttlMs"], "number");
  });

  it("list every tool, read-only except a local create", async () => {
    const result = await modern("tools/list");
    const names = result["tools"].map((t: Json) => t["name"]);
    assert.deepEqual(names, [
      "list_activities",
      "describe_activity",
      "validate_workout",
      "create_workout",
      "inspect_workout",
    ]);
    for (const tool of result["tools"]) assert.equal(tool["annotations"]["readOnlyHint"], true);
    assert.ok(result["ttlMs"] > 0);
    assert.equal(result["cacheScope"], "public");
  });

  it("get back a link that is the workout, and told to show it", async () => {
    const result = await modern("tools/call", { name: "create_workout", arguments: NORWEGIAN });
    assert.notEqual(result["isError"], true);

    const { link, fileName } = result["structuredContent"];
    assert.ok(link.startsWith(`${SITE}/#w=`));
    assert.equal(fileName, "norwegian-4-4.workout");

    const text: string = result["content"][0]["text"];
    assert.ok(text.includes(link), "the link must be in the text the model reads");
    assert.match(text, /Give the user this link in full/);

    const inbound = readWorkoutLink(link.slice(link.indexOf("#")));
    assert.ok(inbound !== undefined);
    const custom = decode(inbound.bytes).customWorkout!;
    assert.equal(custom.displayName, "Norwegian 4×4");
    assert.equal(steps(custom).length, 4);
  });

  it("get a tool error, naming the step, for what the sport cannot do", async () => {
    const result = await modern("tools/call", {
      name: "create_workout",
      arguments: {
        activity: "SWIMMING",
        blocks: [{ repeat: 4, work: { distance: "100" }, alert: { kind: "power", watts: 200 } }],
      },
    });
    assert.equal(result["isError"], true);
    assert.match(result["content"][0]["text"], /SWIMMING has no POWER target \(block 1\)/);
  });

  it("validate with a structured verdict", async () => {
    const result = await modern("tools/call", {
      name: "validate_workout",
      arguments: {
        activity: "CYCLING",
        location: "indoor",
        blocks: [{ work: { distance: "20km" } }],
      },
    });
    assert.equal(result["structuredContent"]["valid"], false);
    assert.equal(result["structuredContent"]["errors"].length, 1);
  });

  it("read back a link", async () => {
    const created = await modern("tools/call", { name: "create_workout", arguments: NORWEGIAN });
    const result = await modern("tools/call", {
      name: "inspect_workout",
      arguments: { source: created["structuredContent"]["link"] },
    });
    assert.match(result["content"][0]["text"], /^Norwegian 4×4\n {2}warmup/);
  });

  it("list, get and read the skill", async () => {
    const listed = await modern("skills/list");
    assert.equal(listed["skills"].length, 1);
    const skill = listed["skills"][0];
    assert.equal(skill["uri"], SKILL_URI);
    assert.equal(skill["frontmatter"]["name"], "apple-watch-workouts");
    const files = skill["resources"].map((r: Json) => r["uri"]);
    assert.ok(files.some((uri: string) => uri.endsWith("references/examples.md")));

    const got = await modern("skills/get", { uri: SKILL_URI });
    assert.equal(got["skill"]["uri"], SKILL_URI);

    const read = await modern("resources/read", { uri: SKILL_URI });
    assert.match(read["contents"][0]["text"], /## The one rule: show the link/);
  });

  it("can get the skill as a prompt instead", async () => {
    const result = await modern("prompts/get", {
      name: "plan_workout",
      arguments: { request: "a Norwegian 4×4 on the bike" },
    });
    const text: string = result["messages"][0]["content"]["text"];
    assert.match(text, /The one rule: show the link/);
    assert.match(text, /# Worked examples/);
    assert.match(text, /Build this workout: a Norwegian 4×4 on the bike$/);
  });
});

describe("2025-11-25 clients", () => {
  it("still initialize and build a workout", async () => {
    const init = await legacy("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "old", version: "1" },
    });
    assert.equal(init["serverInfo"]["name"], "dotworkout");
    assert.match(init["instructions"], /full link/);

    const result = await legacy("tools/call", { name: "create_workout", arguments: NORWEGIAN });
    assert.ok(result["structuredContent"]["link"].startsWith(`${SITE}/#w=`));
  });
});

describe("paces", () => {
  it("become metres per second, slower end first whichever way they are written", () => {
    assert.deepEqual(toAlertSpec({ kind: "pace", pace: "5:00/km" }), {
      kind: "speed",
      metersPerSecond: 1000 / 300,
    });
    const band = toAlertSpec({ kind: "paceRange", from: "4:30/km", to: "4:40/km" });
    assert.equal(band.kind, "speedRange");
    if (band.kind === "speedRange") {
      assert.equal(band.slower, 1000 / 280);
      assert.equal(band.faster, 1000 / 270);
    }
    const mile = toAlertSpec({ kind: "pace", pace: "8:00/mi" });
    assert.equal(mile.kind === "speed" && mile.metersPerSecond, 1609.344 / 480);
  });
});
