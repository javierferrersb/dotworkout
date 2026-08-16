# @dotworkout/domain

Builds and validates Apple `.workout` files. Sits on
[`@dotworkout/codec`](https://www.npmjs.com/package/@dotworkout/codec).

```ts
import { swim } from "@dotworkout/domain";

const bytes = swim("Thursday threshold")
  .warmup(400)
  .repeat(8)
  .of(50)
  .rest(30)
  .label("Build")
  .repeat(4)
  .of(100)
  .on("2:00")
  .cooldown(200)
  .toBytes();
```

`.on("2:00")` is the `DISTANCE_TIME` goal: leave every two minutes however fast
you finish. Only swimming offers it. There are matching builders for `run`,
`bike`, `hiit`, `custom` and `singleGoal`.

`validateWorkout()` checks structure and sport compatibility. Which goals and
alerts each sport allows was read off a real device, and each entry carries a
confidence level: confirmed rules are enforced, unverified ones warn but are
still allowed. Pass `downgradeToWarning` a list of issue codes when the matrix
is wrong, so you never have to edit the library.

The same rules are readable before you build anything, so a UI can offer only
what the sport accepts:

```ts
import { SPORTS, capabilitiesFor } from "@dotworkout/domain";

capabilitiesFor("CYCLING", "indoor"); // no speed target, no distance goal
```

`SPORTS` is every sport the format accepts, with the locations it is offered in
and the unit a bare number is read as.

Three things this deliberately does not do: convert units (lossy, so authored
units are kept), count laps (pool length is chosen on the Watch, not stored in
the file), or assume a container type.

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
