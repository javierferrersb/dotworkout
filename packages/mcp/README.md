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

| Tool | Does |
|---|---|
| `list_activities` | Every activity with the goals and alerts it supports |
| `describe_activity` | One activity in detail, including unverified combinations |
| `validate_workout` | Check a workout without writing anything |
| `create_workout` | Build a `.workout` file and write it to disk |
| `inspect_workout` | Decode an existing file and describe it |

`create_workout` takes an `outputPath` and writes there. Distances and durations
are strings the library parses: `"400"`, `"1.2 km"`, `"0.5mi"`, `"1:00"`,
`":20"`, `"90s"`.

Sports offered both indoors and out take a `location`, and it changes what is
allowed — a stationary bike has no speed target and no distance goal. The warm
up and the cool down carry a target and a label of their own.

## Setup

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
