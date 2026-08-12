# @dotworkout/codec

Decodes and encodes the Apple `.workout` binary format. No validation, no unit
conversion, no opinions — bytes in, message out, and back again byte for byte.

```ts
import { decode, encode, findUnknownFields } from "@dotworkout/codec";

const workout = decode(bytes);
workout.customWorkout?.displayName;

encode(workout); // byte-identical to the input if you changed nothing
```

`decode()` branches on which container the file uses — field 10
(`SingleGoalWorkout`) or field 11 (`CustomWorkout`) — and throws on anything
else rather than guessing.

`findUnknownFields()` walks the whole message tree and reports fields the schema
does not model. Round-tripping a file byte-identically does not prove the schema
is complete; protobuf keeps unrecognised fields and writes them back out. This
is how you check.

To build and validate workouts rather than just read them, use
[`@dotworkout/domain`](https://www.npmjs.com/package/@dotworkout/domain).

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
