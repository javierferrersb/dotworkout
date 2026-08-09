# Constraints

`compatibility.json` is the **single source of truth** for which goals and
alerts each sport allows.

It exists because the `.workout` format encodes none of this. You can serialise
a power alert onto a swim step and get a well-formed file the Watch may reject.
Validation is the library's job, not the codec's.

## Why data and not prose

The matrix is empirically derived from a UI that Apple can change without
notice. It needs versioning, dating, and per-entry confidence — none of which a
markdown table carries. Keeping it as data also means the validator and the
documentation cannot drift apart: the table in `spec/FORMAT.md` §7 is generated
from this file, not maintained alongside it.

## Three tiers of rule

| Tier | Lives in | Example |
|---|---|---|
| Structural invariants | `protovalidate` options in `proto/` | `iterations >= 1`; exactly one container field set |
| Compatibility matrix | this file | swimming allows `DISTANCE_TIME`; HIIT has no distance goal |
| Rationale and provenance | `spec/FORMAT.md` | why pace bounds read backwards |

## Confidence levels

Entries carry a `confidence` field. Treat them differently:

- **confirmed** — enforce.
- **presumed** — allow, no warning.
- **unknown** / `alertsUnverified` / `customWorkoutUnverifiedActivities` —
  **allow and warn**. Never reject on these. A combination that was simply never
  checked is not a combination known to be illegal, and rejecting it would block
  legitimate files on the strength of a gap in our testing.

That asymmetry is deliberate. The cost of wrongly allowing something is a file
the Watch declines to import. The cost of wrongly forbidding something is a
workout the user cannot create at all, with no recourse and no obvious cause.
