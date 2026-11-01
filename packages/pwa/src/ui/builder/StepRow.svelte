<script lang="ts">
  import { slide } from "svelte/transition";
  import { ChevronDown } from "@lucide/svelte";
  import type { CompositionSession, Step } from "../../application/compositionSession.svelte.js";
  import { blockKindName, fieldName, stepDetails, stepMeasure } from "../../i18n/format.js";
  import { t } from "../../i18n/locale.svelte.js";
  import { ms } from "../motion.js";
  import StepEditor from "./StepEditor.svelte";

  interface Props {
    session: CompositionSession;
    entry: Step;
    index: number;
    onremove: (id: number) => void;
    onclose: (id: number) => void;
  }
  let { session, entry, index, onremove, onclose }: Props = $props();

  let open = $derived(session.open === entry.id);
  let draft = $derived(entry.draft);
  let kind = $derived(draft.kind ?? "INTERVAL");
  let measure = $derived(stepMeasure(draft));
  let details = $derived(stepDetails(draft, session.activity.sport));
  let waiting = $derived(session.missingAt(index));
</script>

<div class="step" class:open data-step={entry.id}>
  <button
    type="button"
    class="head"
    aria-expanded={open}
    onclick={() => (open ? onclose(entry.id) : session.toggle(entry.id))}
  >
    <span class="kind">
      <i class="mark {kind}" aria-hidden="true"></i>
      {blockKindName(kind)}
    </span>
    <span class="body">
      <span class="measure" class:empty={measure === ""}>{measure === "" ? "—" : measure}</span>
      {#if details !== ""}<span class="details">{details}</span>{/if}
      {#if waiting !== undefined && !open}
        <span class="waiting">
          {t("step.missing", { field: fieldName(waiting.id, draft, session.activity.sport) })}
        </span>
      {/if}
    </span>
    <ChevronDown class="chevron" size={16} strokeWidth={2} />
  </button>

  {#if open}
    <div transition:slide={{ duration: ms(180) }}>
      <StepEditor
        {session}
        {entry}
        {index}
        ondone={() => onclose(entry.id)}
        onremove={() => onremove(entry.id)}
      />
    </div>
  {/if}
</div>

<style>
  .step {
    position: relative;
  }

  .head {
    display: grid;
    grid-template-columns: var(--label-column, 104px) minmax(0, 1fr) 16px;
    gap: 12px;
    align-items: start;
    width: 100%;
    padding: 13px 16px;
    text-align: left;
    transition: background 100ms var(--ease);
  }

  .head:hover {
    background: color-mix(in srgb, var(--bg-raised) 55%, transparent);
  }

  .head:focus-visible {
    outline-offset: -2px;
    border-radius: 10px;
  }

  .kind {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding-top: 2px;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
  }

  .mark {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .mark.WARMUP,
  .mark.COOLDOWN {
    background: var(--text-tertiary);
  }

  .mark.INTERVAL {
    background: var(--accent);
  }

  .mark.RECOVERY {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--text-tertiary);
  }

  .body {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .measure {
    font-size: 16px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .measure.empty {
    color: var(--text-tertiary);
  }

  .details {
    color: var(--text-secondary);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .waiting {
    color: var(--warn);
    font-size: 12.5px;
    font-weight: 500;
  }

  .head :global(.chevron) {
    margin-top: 3px;
    color: var(--text-tertiary);
    transition: transform 200ms var(--ease);
  }

  .open .head :global(.chevron) {
    transform: rotate(180deg);
  }

  @media (max-width: 560px) {
    .head {
      grid-template-columns: 84px minmax(0, 1fr) 16px;
      gap: 10px;
      padding: 12px 14px;
    }
  }
</style>
