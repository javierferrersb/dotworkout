<script lang="ts">
  import { ChevronDown, ChevronLeft, Download, Minus, Plus } from "@lucide/svelte";
  import { activityName, blockKindName, goalName } from "../i18n/format.js";
  import { keys } from "../i18n/keys.svelte.js";
  import { t } from "../i18n/locale.svelte.js";
  import Kbd from "./Kbd.svelte";

  /*
   * A still of the builder: a run of 8 × 400 m with 90 seconds of rest, the set
   * open with its rest being typed. Words come from the same message keys as
   * the app, so it follows the language. Decorative, so it is hidden from
   * assistive tech and cannot be focused.
   */
  const DESIGN_WIDTH = 664;
  const DESIGN_HEIGHT = 470;

  const sport = "RUNNING";
  // One bar per repetition: warm up, eight reps with rests between, cool down.
  const shape = [
    { kind: "WARMUP", bars: [{ grow: 333, height: 42 }] },
    {
      kind: "INTERVAL",
      bars: Array.from({ length: 8 }, (_, rep) =>
        rep < 7
          ? [
              { grow: 133, height: 72 },
              { grow: 90, height: 16, rest: true },
            ]
          : [{ grow: 133, height: 72 }],
      ).flat(),
    },
    { kind: "COOLDOWN", bars: [{ grow: 333, height: 36 }] },
  ];

  let width = $state(0);
  let scale = $derived(width > 0 ? Math.min(1, width / DESIGN_WIDTH) : 1);
</script>

<div
  class="shot"
  aria-hidden="true"
  inert
  bind:clientWidth={width}
  style:height="{DESIGN_HEIGHT * scale}px"
>
  <div class="plane" style:transform="scale({scale})">
    <div class="window">
      <div class="bar">
        <span class="back"><ChevronLeft size={15} strokeWidth={2} />{t("composer.newWorkout")}</span
        >
        <span class="actions">
          <span class="share">{t("builder.share")}<ChevronDown size={13} strokeWidth={2} /></span>
          <span class="download">
            <Download size={14} strokeWidth={2} />
            {t("rail.download")}
            <Kbd label={keys.save} tone="onAccent" />
          </span>
        </span>
      </div>

      <div class="page">
        <div class="title">{t("naming.defaultTitle", { activity: activityName(sport) })}</div>
        <div class="meta">
          {activityName(sport)}<span class="sep">·</span>{t("builder.steps", { count: 3 })}<span
            class="sep">·</span
          ><span class="total">5.2 km</span>
        </div>

        <div class="strip">
          {#each shape as group, index (index)}
            <span class="group {group.kind}" class:dim={group.kind !== "INTERVAL"}>
              {#each group.bars as bar, at (at)}
                <i
                  class:rest={"rest" in bar}
                  style:flex-grow={bar.grow}
                  style:height="{bar.height}%"
                ></i>
              {/each}
            </span>
          {/each}
        </div>

        <div class="steps">
          <div class="row">
            <span class="kind"><i class="mark WARMUP"></i>{blockKindName("WARMUP")}</span>
            <span class="measure">1 km</span>
            <ChevronDown size={15} strokeWidth={2} />
          </div>

          <div class="row open">
            <span class="kind"><i class="mark INTERVAL"></i>{blockKindName("INTERVAL")}</span>
            <span class="body">
              <span class="measure">8 × 400 m</span>
              <span class="details">{t("step.rest", { time: "1:30" })}</span>
            </span>
            <ChevronDown size={15} strokeWidth={2} class="up" />
          </div>

          <div class="editor">
            <div class="field">
              <span class="label">{t("field.kind")}</span>
              <span class="segmented">
                <span>{blockKindName("RECOVERY")}</span>
                <span class="on">{blockKindName("INTERVAL")}</span>
                <span>{blockKindName("COOLDOWN")}</span>
              </span>
            </div>
            <div class="field">
              <span class="label">{t("field.goal")}</span>
              <span class="segmented">
                <span class="on">{goalName("DISTANCE")}</span>
                <span>{goalName("TIME")}</span>
                <span>{goalName("OPEN")}</span>
              </span>
            </div>
            <div class="field">
              <span class="label">{t("field.distance")}</span>
              <span class="input">400<span class="unit">m</span></span>
            </div>
            <div class="field">
              <span class="label">{t("field.repetitions")}</span>
              <span class="input short">8</span>
              <span class="stepper"
                ><Minus size={13} strokeWidth={2} /><Plus size={13} strokeWidth={2} /></span
              >
            </div>
            <div class="field">
              <span class="label">{t("question.recovery")}</span>
              <span class="input focus">1:30<i class="caret"></i></span>
            </div>
          </div>

          <div class="row">
            <span class="kind"><i class="mark COOLDOWN"></i>{blockKindName("COOLDOWN")}</span>
            <span class="measure">1 km</span>
            <ChevronDown size={15} strokeWidth={2} />
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .shot {
    position: relative;
    width: 100%;
    max-width: 664px;
    pointer-events: none;
    user-select: none;
  }

  .plane {
    position: absolute;
    top: 0;
    left: 0;
    width: 664px;
    height: 470px;
    transform-origin: top left;
    /* The window runs on below the frame; it fades out over the steps that
       follow rather than stopping on a hard edge. */
    mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
  }

  .window {
    height: 560px;
    border: 1px solid var(--hairline-strong);
    border-radius: 14px;
    background: var(--bg-canvas);
    box-shadow: var(--shadow-pop);
    overflow: hidden;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 46px;
    padding: 0 12px 0 10px;
    border-bottom: 1px solid var(--hairline);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
  }

  .back,
  .actions,
  .share,
  .download {
    display: inline-flex;
    align-items: center;
  }

  .back {
    gap: 2px;
  }

  .actions {
    gap: 8px;
  }

  .share {
    gap: 6px;
    height: 28px;
    padding: 0 9px 0 11px;
    border: 1px solid var(--hairline-strong);
    border-radius: 7px;
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  .download {
    gap: 6px;
    height: 28px;
    padding: 0 5px 0 10px;
    border-radius: 7px;
    background: var(--ink);
    color: var(--on-ink);
    font-weight: 600;
  }

  .page {
    padding: 22px 28px 0;
  }

  .title {
    font-size: 21px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .meta {
    margin: 3px 0 14px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .sep {
    margin: 0 6px;
    color: var(--text-tertiary);
  }

  .total {
    color: var(--text-primary);
    font-weight: 500;
  }

  .strip {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 34px;
    margin-bottom: 12px;
  }

  .group {
    display: flex;
    align-items: flex-end;
    gap: 1.5px;
    height: 100%;
  }

  .group.WARMUP,
  .group.COOLDOWN {
    flex: 333;
  }

  .group.INTERVAL {
    flex: 1694;
  }

  .group.dim {
    opacity: 0.38;
  }

  .group i {
    flex-basis: 0;
    min-width: 2px;
    border-radius: 2px 2px 1px 1px;
    background: var(--accent);
  }

  .group.WARMUP i,
  .group.COOLDOWN i {
    background: var(--text-tertiary);
  }

  .group i.rest {
    background: var(--hairline-strong);
  }

  .steps {
    border: 1px solid var(--hairline);
    border-radius: 12px;
    background: var(--bg-surface);
  }

  .row {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr) 15px;
    gap: 12px;
    align-items: start;
    padding: 12px 14px;
    color: var(--text-tertiary);
  }

  .row + .row,
  .editor + .row {
    border-top: 1px solid var(--hairline);
  }

  .row :global(.up) {
    transform: rotate(180deg);
  }

  .kind {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding-top: 2px;
    color: var(--text-secondary);
    font-size: 12.5px;
    font-weight: 500;
  }

  .mark {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--text-tertiary);
  }

  .mark.INTERVAL {
    background: var(--accent);
  }

  .body {
    display: grid;
    gap: 1px;
  }

  .measure {
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 500;
  }

  .details {
    color: var(--text-secondary);
    font-size: 12.5px;
  }

  .editor {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-top: 1px solid var(--hairline);
  }

  .field {
    display: grid;
    grid-template-columns: 96px auto auto 1fr;
    gap: 12px;
    align-items: center;
  }

  .label {
    color: var(--text-secondary);
    font-size: 12.5px;
  }

  .segmented {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: 8px;
    background: var(--bg-raised);
    color: var(--text-secondary);
    font-size: 12.5px;
    font-weight: 500;
  }

  .segmented span {
    padding: 4px 11px;
    border-radius: 6px;
  }

  .segmented .on {
    background: var(--segment-on);
    color: var(--text-primary);
    box-shadow:
      0 0 0 0.5px var(--hairline-strong),
      0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .input {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 124px;
    height: 30px;
    padding: 0 4px 0 10px;
    border: 1px solid var(--hairline-strong);
    border-radius: 7px;
    background: var(--bg-surface);
    font-size: 14px;
    font-weight: 500;
  }

  .input.short {
    width: 72px;
  }

  .input.focus {
    justify-content: flex-start;
    gap: 0;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  .unit {
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--bg-raised);
    color: var(--text-secondary);
    font-size: 12px;
  }

  .caret {
    display: inline-block;
    width: 1.5px;
    height: 1.05em;
    margin-left: 1px;
    background: var(--accent);
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    height: 30px;
    padding: 0 10px;
    border-radius: 7px;
    background: var(--bg-raised);
    color: var(--text-secondary);
  }
</style>
