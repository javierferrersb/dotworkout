<script lang="ts">
  import type { Snippet } from "svelte";
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import { Check } from "@lucide/svelte";
  import { menuKeydown } from "./menuKeys.js";
  import { ms } from "./motion.js";

  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    label: string;
    options: readonly Option[];
    selected: string;
    trigger: Snippet;
    onselect: (value: string) => void;
  }
  let { label, options, selected, trigger, onselect }: Props = $props();

  let open = $state(false);
  let root = $state<HTMLDivElement | undefined>(undefined);
  let button = $state<HTMLButtonElement | undefined>(undefined);
  let items = $state<HTMLButtonElement[]>([]);

  // Opening puts focus on the current choice, so the arrows start from there.
  function show() {
    open = true;
    void tick().then(() => {
      const current = options.findIndex((option) => option.value === selected);
      items[Math.max(0, current)]?.focus();
    });
  }

  function hide(refocus: boolean) {
    open = false;
    if (refocus) button?.focus();
  }

  function onTriggerKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show();
    }
  }

  function away(event: MouseEvent) {
    if (open && root !== undefined && !root.contains(event.target as Node)) open = false;
  }
</script>

<svelte:window onclick={away} />

<div class="menu" bind:this={root}>
  <button
    bind:this={button}
    class="trigger"
    onclick={() => (open ? hide(false) : show())}
    onkeydown={onTriggerKey}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={label}
  >
    {@render trigger()}
  </button>

  {#if open}
    <div
      class="popover"
      role="menu"
      aria-label={label}
      tabindex="-1"
      transition:fly={{ y: -4, duration: ms(140) }}
      onkeydown={(event) => menuKeydown(event, items, hide)}
    >
      <p class="caption" aria-hidden="true">{label}</p>
      {#each options as option, index (option.value)}
        <button
          bind:this={items[index]}
          class="option"
          role="menuitemradio"
          aria-checked={option.value === selected}
          onclick={() => {
            onselect(option.value);
            hide(true);
          }}
        >
          <span>{option.label}</span>
          {#if option.value === selected}<Check size={14} strokeWidth={2} />{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: var(--radius-control);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    transition:
      background 120ms var(--ease),
      color 120ms var(--ease);
  }

  .trigger:hover,
  .trigger[aria-expanded="true"] {
    background: var(--bg-raised);
    color: var(--text-primary);
  }

  .popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 40;
    min-width: 180px;
    padding: 4px;
    border-radius: 10px;
    background: var(--bg-surface);
    box-shadow: var(--shadow-pop);
    border: 1px solid var(--hairline);
  }

  .popover:focus {
    outline: none;
  }

  .caption {
    margin: 6px 8px 4px;
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 7px 8px;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 14px;
    text-align: left;
  }

  .option:hover,
  .option:focus-visible {
    background: var(--bg-raised);
    outline: none;
  }
</style>
