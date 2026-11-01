<script lang="ts">
  import { CornerDownLeft, Download } from "@lucide/svelte";
  import type { BlockDraft } from "../domain/block.js";
  import { activityName, blockKindName, blockSummary } from "../i18n/format.js";
  import { keys } from "../i18n/keys.svelte.js";
  import { t } from "../i18n/locale.svelte.js";
  import Kbd from "./Kbd.svelte";

  /*
   * A still of the real composer: the question being answered and the rail it
   * feeds. Words come from the same message keys as the app, so it follows the
   * language; the sample session is the one the welcome copy promises, 8 × 400 m
   * with 90 seconds of rest. Decorative, so it is hidden from assistive tech
   * and cannot be focused.
   */
  const DESIGN_WIDTH = 664;
  const DESIGN_HEIGHT = 470;

  const blocks: readonly BlockDraft[] = [
    { kind: "WARMUP", distance: { value: 1, unit: "km" } },
    {
      kind: "INTERVAL",
      repetitions: 8,
      distance: { value: 400, unit: "m" },
      recovery: { value: 90, unit: "s" },
    },
    { kind: "COOLDOWN", distance: { value: 1, unit: "km" } },
  ];
  const current = 1;

  const answers = $derived([
    { label: t("question.kind"), value: blockKindName("INTERVAL") },
    { label: t("question.distance"), value: "400 m" },
    { label: t("question.repetitions"), value: "8" },
  ]);

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
    <div class="pane">
      <h3>{t("block.untitled", { index: current + 1 })}</h3>
      <p class="sub">{t("block.editing", { index: current + 1, total: blocks.length })}</p>

      <div class="answers">
        {#each answers as answer (answer.label)}
          <div class="answer">
            <span class="label">{answer.label}</span>
            <span class="value">{answer.value}</span>
          </div>
        {/each}
      </div>

      <div class="prompt">
        <h4>{t("question.recovery")}</h4>
        <div class="field">
          <span class="typed">1:30<i class="caret"></i></span>
          <span class="go"><CornerDownLeft size={14} strokeWidth={2} />{keys.enter}</span>
        </div>
      </div>
    </div>

    <div class="rail">
      <h3>{t("naming.defaultTitle", { activity: activityName("RUNNING") })}</h3>
      <p class="sub">{activityName("RUNNING")}</p>

      <div class="blocks">
        {#each blocks as block, index (index)}
          <div class="card" class:on={index === current}>
            <span class="kind">{blockKindName(block.kind ?? "INTERVAL")}</span>
            <span class="measure">{blockSummary(block)}</span>
          </div>
        {/each}
      </div>

      <div class="total">
        <span class="word">{t("rail.total")}</span>
        <span class="amount">5.2 km</span>
      </div>

      <div class="download">
        <Download size={16} strokeWidth={2} />
        {t("rail.download")}
        <Kbd label={keys.save} tone="onAccent" />
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
  }

  .pane,
  .rail {
    position: absolute;
    border-radius: 14px;
    border: 1px solid var(--hairline-strong);
    background: var(--bg-canvas);
  }

  .pane {
    top: 0;
    left: 0;
    width: 400px;
    padding: 22px 20px 20px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .rail {
    top: 74px;
    left: 384px;
    width: 280px;
    padding: 18px 16px 16px;
    box-shadow: var(--shadow-pop);
  }

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .sub {
    margin: 2px 0 0;
    color: var(--text-tertiary);
    font-size: 12.5px;
  }

  .answers {
    display: grid;
    gap: 1px;
    margin: 12px -8px 14px;
  }

  .answer {
    display: grid;
    grid-template-columns: 138px 1fr;
    gap: 8px;
    padding: 7px 8px;
    font-size: 13.5px;
  }

  .label {
    color: var(--text-tertiary);
  }

  .value {
    font-weight: 500;
  }

  .prompt {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--hairline);
    border-radius: var(--radius-card);
    background: var(--bg-surface);
  }

  h4 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 4px 4px 4px 14px;
    border: 1px solid var(--accent);
    border-radius: var(--radius-control);
    background: var(--bg-surface);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  .typed {
    font-size: 19px;
    font-weight: 500;
  }

  .caret {
    display: inline-block;
    width: 1.5px;
    height: 1.05em;
    margin-left: 1px;
    vertical-align: -0.15em;
    background: var(--accent);
  }

  .go {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: var(--ink);
    color: var(--on-ink);
    font-size: 12.5px;
    font-weight: 600;
  }

  .blocks {
    display: grid;
    gap: 6px;
    margin: 14px 0 16px;
  }

  .card {
    display: grid;
    gap: 2px;
    padding: 10px 12px;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--bg-surface);
  }

  .card.on {
    border-color: var(--accent);
  }

  .kind {
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
  }

  .measure {
    font-size: 14.5px;
  }

  .total {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
    padding: 0 2px;
  }

  .word {
    color: var(--text-secondary);
    font-size: 13px;
  }

  .amount {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .download {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px;
    border-radius: var(--radius-control);
    background: var(--ink);
    color: var(--on-ink);
    font-size: 14px;
    font-weight: 600;
  }
</style>
