<script lang="ts">
  import { toMeters, toSeconds } from "@dotworkout/domain";
  import type { CompositionSession } from "../../application/compositionSession.svelte.js";
  import type { BlockDraft } from "../../domain/block.js";
  import { blockKindName, stepMeasure } from "../../i18n/format.js";
  import { t } from "../../i18n/locale.svelte.js";

  interface Props {
    session: CompositionSession;
    onpick: (id: number) => void;
  }
  let { session, onpick }: Props = $props();

  /*
   * The shape of the session at a glance: one bar per repetition, as wide as
   * it is long and as tall as it is hard. Length mixes distance and time, so
   * distances are turned into time at an easy pace for the sport. It is a
   * picture of the session, not a measurement of it.
   */
  const EASY_SPEED: Record<string, number> = {
    RUNNING: 3,
    WALKING: 1.4,
    HIKING: 1.2,
    CYCLING: 7,
    SWIMMING: 0.8,
    ROWING: 2.2,
  };
  const MAX_REPS = 24;

  interface Bar {
    readonly weight: number;
    readonly height: number;
    readonly rest: boolean;
  }

  function seconds(draft: BlockDraft, sport: string): number {
    if (draft.kind === "RECOVERY")
      return draft.duration === undefined ? 60 : toSeconds(draft.duration);
    if (draft.goalKind === "TIME" && draft.duration !== undefined) return toSeconds(draft.duration);
    if (draft.sendOff !== undefined) return toSeconds(draft.sendOff);
    if (draft.distance !== undefined) return toMeters(draft.distance) / (EASY_SPEED[sport] ?? 2.5);
    return 240;
  }

  function effort(draft: BlockDraft): number {
    const alert = draft.alert;
    if (alert?.metric === "HEART_RATE" && alert.style === "ZONE") return 0.25 + alert.zone * 0.15;
    if (alert !== undefined) return 0.85;
    switch (draft.kind) {
      case "WARMUP":
        return 0.42;
      case "COOLDOWN":
        return 0.36;
      case "RECOVERY":
        return 0.16;
      default:
        return 0.72;
    }
  }

  function bars(draft: BlockDraft, sport: string): Bar[] {
    const work: Bar = {
      weight: seconds(draft, sport),
      height: effort(draft),
      rest: draft.kind === "RECOVERY",
    };
    if (draft.kind !== "INTERVAL") return [work];
    const reps = Math.min(MAX_REPS, Math.max(1, draft.repetitions ?? 1));
    const rest =
      draft.recovery === undefined
        ? undefined
        : { weight: toSeconds(draft.recovery), height: 0.16, rest: true };
    return Array.from({ length: reps }, (_, rep) =>
      rest !== undefined && rep < reps - 1 ? [work, rest] : [work],
    ).flat();
  }

  let groups = $derived(
    session.steps.map((entry) => {
      const shape = bars(entry.draft, session.activity.sport);
      return {
        id: entry.id,
        kind: entry.draft.kind ?? "INTERVAL",
        label:
          `${blockKindName(entry.draft.kind ?? "INTERVAL")} ${stepMeasure(entry.draft)}`.trim(),
        bars: shape,
        weight: shape.reduce((sum, bar) => sum + bar.weight, 0),
      };
    }),
  );
</script>

<div class="strip" class:focusing={session.open !== undefined} aria-label={t("builder.structure")}>
  {#each groups as group (group.id)}
    <button
      type="button"
      class="group {group.kind}"
      class:on={session.open === group.id}
      style:flex-grow={group.weight}
      title={group.label}
      aria-label={group.label}
      tabindex="-1"
      onclick={() => onpick(group.id)}
    >
      {#each group.bars as bar, at (at)}
        <span
          class="bar"
          class:rest={bar.rest}
          style:flex-grow={bar.weight}
          style:height="{Math.round(bar.height * 100)}%"
        ></span>
      {/each}
    </button>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 44px;
  }

  .group {
    display: flex;
    align-items: flex-end;
    gap: 1.5px;
    flex-basis: 0;
    min-width: 6px;
    height: 100%;
    padding: 0;
    border-radius: 3px;
    transition: opacity 160ms var(--ease);
  }

  .focusing .group:not(.on) {
    opacity: 0.38;
  }

  .group:hover {
    opacity: 1 !important;
  }

  .bar {
    flex-basis: 0;
    min-width: 2px;
    border-radius: 2px 2px 1px 1px;
    background: var(--accent);
    transition: height 200ms var(--ease);
  }

  .WARMUP .bar,
  .COOLDOWN .bar {
    background: var(--text-tertiary);
  }

  .bar.rest {
    background: var(--hairline-strong);
  }
</style>
