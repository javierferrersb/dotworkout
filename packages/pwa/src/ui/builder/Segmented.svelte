<script lang="ts">
  interface Option {
    value: string;
    label: string;
    /** The key that picks this option while the group has focus. */
    key?: string;
    /** Shown on hover and marked, for choices that need a caveat. */
    note?: string;
  }

  interface Props {
    label: string;
    options: readonly Option[];
    selected: string | undefined;
    onselect: (value: string) => void;
    /** A choice made by its key: the caller moves on to the next field. */
    onpick?: (from: HTMLElement) => void;
  }
  let { label, options, selected, onselect, onpick }: Props = $props();

  let buttons = $state<HTMLButtonElement[]>([]);
  let focusable = $derived(
    Math.max(
      0,
      options.findIndex((option) => option.value === selected),
    ),
  );

  // A radio group: Tab reaches it once, the arrows move and choose, and an
  // option's own key chooses it and hands on to the next field.
  function onkeydown(event: KeyboardEvent, index: number) {
    const by = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (by !== 0) {
      event.preventDefault();
      event.stopPropagation();
      const next = (index + by + options.length) % options.length;
      const option = options[next];
      if (option === undefined) return;
      onselect(option.value);
      buttons[next]?.focus();
      return;
    }

    if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;
    const typed = event.key.toLowerCase();
    const at = options.findIndex((option) => option.key?.toLowerCase() === typed);
    const option = options[at];
    const button = buttons[at];
    if (option === undefined || button === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    onselect(option.value);
    button.focus();
    onpick?.(button);
  }
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option, index (option.value)}
    <button
      bind:this={buttons[index]}
      type="button"
      role="radio"
      aria-checked={option.value === selected}
      aria-keyshortcuts={option.key}
      tabindex={index === focusable ? 0 : -1}
      class:on={option.value === selected}
      title={option.note}
      onclick={() => onselect(option.value)}
      onkeydown={(event) => onkeydown(event, index)}
    >
      {#if option.key}<kbd class="key" aria-hidden="true">{option.key}</kbd>{/if}
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
    display: inline-flex;
    align-items: center;
    gap: 6px;
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

  /* Keys show once someone is driving with the keyboard, and stay out of the
     way of a pointer or a finger. */
  .key {
    display: none;
    place-items: center;
    min-width: 17px;
    height: 17px;
    margin-left: -5px;
    padding: 0 4px;
    border: 1px solid var(--hairline-strong);
    border-radius: 4px;
    color: var(--text-tertiary);
    font-family: var(--sans);
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1;
  }

  :global(html[data-modality="keyboard"]) .key {
    display: inline-grid;
  }

  button.on .key {
    color: var(--text-secondary);
  }

  .flag {
    margin-left: -4px;
    color: var(--text-tertiary);
  }
</style>
