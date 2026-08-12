# @dotworkout/mcp

An MCP server that lets an agent build Apple `.workout` files.

Not published to npm yet. See below for running it from a clone.

## Why

No model knows this format — it is undocumented binary protobuf. It also does
not know which goals and alerts each sport actually offers, because that was
read off a real device and lives in `constraints/compatibility.json`. Ask for a
power target on a swim and you get a file the Watch rejects. These tools hand
the agent the real answer instead.

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

## Running it from a clone

```bash
git clone https://github.com/javierferrersb/dotworkout
cd dotworkout
npm install
npm run build
```

Then point your client at the built entry point.

**Claude Code**

```bash
claude mcp add dotworkout -- node /absolute/path/to/dotworkout/packages/mcp/dist/src/index.js
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dotworkout": {
      "command": "node",
      "args": ["/absolute/path/to/dotworkout/packages/mcp/dist/src/index.js"]
    }
  }
}
```

Restart the client. Then ask for something like *"build me an 8×100 swim on
1:45 with a 400 warm up, save it to my desktop"*.

Everything runs on your machine. Nothing is uploaded.

## Credits

The protobuf schema started from
[changeforan/DotnetWorkoutKit](https://github.com/changeforan/DotnetWorkoutKit)
(MIT). Ten missing fields and enum values were added; see `spec/FORMAT.md` §8 in
the repo. No code was taken.

Not affiliated with Apple.

## Licence

MIT. See [LICENSE](LICENSE).
