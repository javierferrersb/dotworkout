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

## Setup

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

Ask for a workout in plain language:

> build me an 8×100 swim on 1:45 with a 400 warm up, save it to my desktop

Then send the file to your phone and open it in the Workout app.

Everything runs on your machine. Nothing is uploaded.

## Credits

The protobuf schema started from
[changeforan/DotnetWorkoutKit](https://github.com/changeforan/DotnetWorkoutKit)
(MIT). Ten missing fields and enum values were added; see `spec/FORMAT.md` §8 in
the repo. No code was taken.

Not affiliated with Apple.

## Licence

MIT. See [LICENSE](LICENSE).
