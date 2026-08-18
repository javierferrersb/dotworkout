# @dotworkout/mcp

An MCP server that lets an agent build Apple `.workout` files.

## Why

No model knows this format. It is undocumented binary protobuf, so an agent
cannot write one from memory. It also does not know which goals and alerts each
sport offers, because that was read off a real device and lives in
`constraints/compatibility.json` — ask for a power target on a swim and you get
a file the Watch rejects. These tools give the agent the real answer, and a
validator that says what is wrong.

## Tools

| Tool                | Does                                                      |
| ------------------- | --------------------------------------------------------- |
| `list_activities`   | Every activity with the goals and alerts it supports      |
| `describe_activity` | One activity in detail, including unverified combinations |
| `validate_workout`  | Check a workout without writing anything                  |
| `create_workout`    | Build a `.workout` file and write it to disk              |
| `inspect_workout`   | Decode an existing file and describe it                   |

Run locally, `create_workout` takes an `outputPath` and writes there; run as a
remote server it returns a link instead, because the disk it is running on is
not yours. Distances and durations are strings the library parses: `"400"`,
`"1.2 km"`, `"0.5mi"`, `"1:00"`, `":20"`, `"90s"`.

Sports offered both indoors and out take a `location`, and it changes what is
allowed — a stationary bike has no speed target and no distance goal. The warm
up and the cool down carry a target and a label of their own.

## Getting the file onto the phone

The file lands on the machine Claude is running on, which is not the one paired
with your Watch. So the local server also prints a QR code. Scan it and the
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
inside it instead. Open that on the phone and the composer loads it ready to
download. `inspect_workout` takes the same link back.

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
