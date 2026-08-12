# @dotworkout/notation

Parses swim sets written as text into workout blocks. Sits on
[`@dotworkout/domain`](https://www.npmjs.com/package/@dotworkout/domain).

Not published to npm. Nothing in the repo consumes it since the terminal
composer was removed, so it is not being shipped until something does.

```ts
import { parseLine, applyLines } from "@dotworkout/notation";

parseLine("8x50 on 1:00 Build");
applyLines(["400 warmup", "8x50 on 1:00 Build", "200 cd"]);
```

```
400 warmup            warm up of 400 m
8x50 on 1:00          8 × 50 m, leaving every 1:00
4x100 pull rest :20   labelled "pull", 20 s rest after each
4x1:00                4 × 1 minute
8x50 z3               heart-rate zone 3
100y                  100 yards, stored as yards
200 cd                cool down
```

A bare number is a distance. Times need a colon or a unit, because guessing
wrong there gives you a different workout without saying so. Words the grammar
does not recognise become the step label — the format has no stroke field, so
stroke is free text.

Format notes, provenance and open questions:
[github.com/javierferrersb/dotworkout](https://github.com/javierferrersb/dotworkout)

## Credits

The protobuf schema started from
[changeforan/DotnetWorkoutKit](https://github.com/changeforan/DotnetWorkoutKit)
(MIT). Ten missing fields and enum values were added; see `spec/FORMAT.md` §8 in
the repo. No code was taken.

Not affiliated with Apple.

## Licence

MIT. See [LICENSE](LICENSE).
