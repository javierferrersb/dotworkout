<script lang="ts">
  interface Option {
    value: string;
    label: string;
    /** Shown on hover and marked, for choices that need a caveat. */
    note?: string;
  }

  interface Props {
    label: string;
    options: readonly Option[];
    selected: string | undefined;
    onselect: (value: string) => void;
  }
  let { label, options, selected, onselect }: Props = $props();

  let buttons = $state<HTMLButtonElement[]>([]);
  let focusable = $derived(
    Math.max(
      0,
      options.findIndex((option) => option.value === selected),
    ),
  );

  // A radio group: Tab reaches it once, the arrows move and choose.
  function onkeydown(event: KeyboardEvent, index: number) {
    const by = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (by === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = (index + by + options.length) % options.length;
    const option = options[next];
    if (option === undefined) return;
    onselect(option.value);
    buttons[next]?.focus();
  }
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option, index (option.value)}
    <button
      bind:this={buttons[index]}
      type="button"
      role="radio"
      aria-checked={option.value === selected}
      tabindex={index === focusable ? 0 : -1}
      class:on={option.value === selected}
      title={option.note}
      onclick={() => onselect(option.value)}
      onkeydown={(event) => onkeydown(event, index)}
    >
      {option.label}{#if option.note}<span class="flag" aria-hidden="true">*</span>{/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    max-width: 100%;
    padding: 2px;
    border-radius: 9px;
    background: var(--bg-raised);
  }

  button {
    padding: 5px 12px;
    border-radius: 7px;
    color: var(--text-secondary);
    font-size: 13.5px;
    font-weight: 500;
    line-height: 1.35;
    white-space: nowrap;
    transition:
      background 120ms var(--ease),
      color 120ms var(--ease),
      box-shadow 120ms var(--ease);
  }

  button:hover:not(.on) {
    color: var(--text-primary);
  }

  button.on {
    background: var(--segment-on);
    color: var(--text-primary);
    box-shadow:
      0 0 0 0.5px var(--hairline-strong),
      0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .flag {
    margin-left: 1px;
    color: var(--text-tertiary);
  }
</style>
