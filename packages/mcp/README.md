# @dotworkout/mcp

An MCP server that lets an agent build Apple `.workout` files.

Run it locally over stdio, or connect to the hosted one at
`https://mcp.javierferrersb.dev/mcp` from anything that cannot spawn a process —
a phone, ChatGPT, Claude in a browser.

## Why

No model knows this format. It is undocumented binary protobuf, so an agent
cannot write one from memory. It also does not know which goals and alerts each
sport offers, because that was read off a real device and lives in
`constraints/compatibility.json` — ask for a power target on a swim and you get
a file the Watch rejects. These tools give the agent the real answer, and a
validator that says what is wrong.

## Tools

| Tool                | Does                                                        |
| ------------------- | ----------------------------------------------------------- |
| `list_activities`   | Every activity with the goals and alerts it supports        |
| `describe_activity` | One activity in detail, including unverified combinations   |
| `validate_workout`  | Check a workout without building it                         |
| `create_workout`    | Build a workout and return the link that carries it         |
| `inspect_workout`   | Decode a workout link (or, locally, a file) and describe it |

Every tool but a local `create_workout` is marked read-only, so a client can run
them without asking. `create_workout` and `validate_workout` also return
structured results (`link`, `fileName`, `warnings`…; `valid`, `errors`) next to
the text, and a refusal comes back as a tool error naming the step that is
wrong.

Distances and durations are strings the library parses: `"400m"`, `"1.2 km"`,
`"0.5mi"`, `"4:00"`, `":20"`, `"90s"`, `"10min"`. Write the unit: a bare number
is seconds, or the sport's default unit, which is kilometres for a run, so the
server warns about `"400"` on one. Targets take heart-rate zones or ranges,
power, cadence, and paces (`"4:30/km"`, `"7:00/mi"`) or km/h, which the server
converts to the metres per second the file stores.

Sports offered both indoors and out take a `location`, and it changes what is
allowed — a stationary bike has no speed target and no distance goal. The warm
up and the cool down carry a target and a label of their own.

## The link is the workout

`create_workout` returns a link with the whole workout encoded after `#w=`.
Nothing is stored on a server, so the link is the only copy, and the model has
to hand it to the user intact. The server says so in three places the model
reads: its instructions, the tool description, and the result itself, which
puts the rule right above the link. A reply looks like this:

> Here's your Norwegian 4×4: a 10 minute warm up, four 4 minute intervals in
> zone 4 with 3 minute jogs, and a 5 minute cool down. Open this on your iPhone
> and tap Download:
>
> https://workout.javierferrersb.dev/#w=SiREODRGMDU5RC04NzM1…&n=Norwegian%204%C3%974

(The real link is longer; the model is told to paste all of it.)

## The skill

The server also ships a skill, `apple-watch-workouts`, in
[`skills/`](skills/apple-watch-workouts/SKILL.md): how to turn a training idea
into a spec, the units and targets each field takes, what each sport supports,
and how to reply. Its [examples](skills/apple-watch-workouts/references/examples.md)
are real workouts, each with the request, the exact `create_workout` arguments
and notes: Norwegian 4×4 (run and bike), tempo on a pace band, track 400s, mile
repeats, a long run, a treadmill progression, FTP 2×20, 30/30s, cadence drills,
a swim pyramid, send-offs, an IM set, yards, Tabata, a strength circuit, max-rep
sets, rowing and walking, plus the mistakes the validator catches. The test
suite builds every one of them and checks the strict validator accepts it, so
an example cannot quietly go stale.

It reaches the model three ways, because hosts are at different stages:

- **The MCP Skills extension** ([SEP-2640](https://modelcontextprotocol.io/seps/2640-skills-extension)).
  A host that supports it lists the skill with `skills/list` and loads it like a
  local one, marked as coming from this server.
- **A resource.** The server instructions name its URI,
  `skill://dotworkout/apple-watch-workouts/SKILL.md`, which any client can read
  with `resources/read`.
- **A prompt.** `plan_workout` returns the skill and the examples as one
  message, with an optional `request` ("a Norwegian 4×4 on the bike").

The markdown under `skills/` is the source. It is compiled into the server by
`npm run generate:skills`, because the Workers build has no filesystem; CI fails
if the two differ.

## Protocol

Built on the MCP TypeScript SDK v2, which speaks the 2026-07-28 revision
(stateless: no handshake and no session; cache hints on lists; `Mcp-Method` and
`Mcp-Name` headers) and still serves 2025-11-25 clients, over HTTP and stdio
alike. Nobody has to upgrade their client to keep using it.

## Getting the file onto the phone

Run locally, `create_workout` takes an optional `outputPath` (`~` works) and
writes the file there too. That file lands on the machine Claude is running on,
which is not the one paired with your Watch. So the local server also prints a
QR code. Scan it and the
composer opens on your phone with the workout already loaded, ready to
download — the workout travels inside the link itself, so nothing is uploaded
and no account is involved.

Blocks are drawn light-on-dark, which is right for a dark terminal. Set
`DOTWORKOUT_QR_INVERT=1` for a light one. `DOTWORKOUT_SITE` points the link
somewhere other than the hosted composer.

The remote server does not draw one: a client reading its reply on a phone can
simply open the link, and one that cannot is talking to something that can draw
a QR itself.

## Setup

There are two ways to run this. Locally over stdio, which is the simplest and
covers desktop clients; or as a remote server over HTTP, which is the only way
to reach a phone, ChatGPT, or claude.ai in a browser.

### Locally, over stdio

Needs [Claude Code](https://claude.com/claude-code) — the CLI, not the Claude
website or the desktop chat. Register the server once:

```bash
claude mcp add -s user dotworkout -- npx -y @dotworkout/mcp
```

Nothing to install first. `npx` fetches the package on the first run and caches
it.

`-s user` matters. Without it the server is registered against the current
directory only, so it disappears the moment you work anywhere else.

Check it took:

```bash
claude mcp list
```

It should print `dotworkout: … ✔ Connected`.

### Remotely, over HTTP

A client that cannot spawn a local process — a phone, ChatGPT, claude.ai — needs
the server at a URL instead. One is already running:

```
https://mcp.javierferrersb.dev/mcp
```

Paste that into Claude's custom connector settings, or ChatGPT's Settings →
Apps → Advanced → Developer mode. There is nothing to install and no account to
make. It stores nothing, so there is nothing to sign in to.

To run your own instead, deploy it to your own Cloudflare account:

```bash
npm run deploy --workspace @dotworkout/mcp
```

That prints the URL it published to; the endpoint is the `/mcp` path on it.
`wrangler dev` runs the same thing locally first, and `DOTWORKOUT_SITE` in
`wrangler.toml` points the links it returns at a composer other than the hosted
one.

It fits the free plan. Every tool is well inside the 10 ms of CPU a free request
gets, and the whole thing starts in about half of the 1 second allowed — there
is no database, no session and no storage, because everything the server needs
arrives in the request.

The remote server has no `create_workout` that writes to disk, because the disk
it runs on is not the one beside your phone. It returns a link with the workout
inside it, and `inspect_workout` takes that link back.

It can also attach the file itself, with `attachFile: true`. That is off by
default and worth knowing why: a client that does not render embedded resources
does not ignore the block, it rejects the whole reply against its own schema,
and the caller gets an error instead of a workout. Claude Code does exactly
that today. Turn it on for a client you know renders attachments.

The link is the part that always works, and it matters that neither route asks a
model to turn base64 into bytes. Asked to do that, one dropped a byte off the
end, and the Watch refused a workout that was otherwise perfect.

Moving to the 2026-07-28 protocol does not change this. It adds no new way to
send a file: a tool can still return a file only as an embedded resource (the
attachment above) or as a `resource_link` the client has to fetch and save,
and how either is shown is still up to the client. The link stays the default.

## Using it

Ask in plain language, and end with **use dotworkout** so Claude reaches for
these tools instead of answering from memory:

> Build me a swimming pyramid workout and save it to my desktop. Use dotworkout.

> Make me a Norwegian 4×4 — four by four minutes in zone 4 with three minute
> jogs between — and put it on my desktop. Use dotworkout.

> What targets does an indoor cycle actually support? Build me a 45 minute
> session using them. Use dotworkout.

That last one is the point of the server: Claude can ask what a sport supports
rather than guess.

Then send the file to your phone and open it there; it lands in the Workout app
on your Watch.

Everything runs on your machine. Nothing is uploaded.

## Credits

The protobuf schema started from
[changeforan/DotnetWorkoutKit](https://github.com/changeforan/DotnetWorkoutKit)
(MIT). Ten missing fields and enum values were added; see `spec/FORMAT.md` §8 in
the repo. No code was taken.

Not affiliated with Apple.

## Licence

MIT. See [LICENSE](LICENSE).
