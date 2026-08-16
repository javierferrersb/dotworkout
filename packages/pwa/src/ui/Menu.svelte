<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";
  import { Check } from "@lucide/svelte";

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

  function away(event: MouseEvent) {
    if (open && root !== undefined && !root.contains(event.target as Node)) open = false;
  }
</script>

<svelte:window onclick={away} onkeydown={(event) => event.key === "Escape" && (open = false)} />

<div class="menu" bind:this={root}>
  <button class="trigger" onclick={() => (open = !open)} aria-haspopup="menu" aria-expanded={open}>
    {@render trigger()}
  </button>

  {#if open}
    <div class="popover" role="menu" transition:fly={{ y: -6, duration: 160 }}>
      <p class="caption">{label}</p>
      {#each options as option (option.value)}
        <button
          class="option"
          role="menuitemradio"
          aria-checked={option.value === selected}
          onclick={() => {
            onselect(option.value);
            open = false;
          }}
        >
          <span>{option.label}</span>
          {#if option.value === selected}<Check size={15} strokeWidth={2.6} />{/if}
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
    gap: 7px;
    padding: 8px 14px;
    border-radius: var(--radius-pill);
    color: var(--text-secondary);
    font-size: 14px;
    transition: all 140ms var(--ease);
  }

  .trigger:hover {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  .popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 40;
    min-width: 190px;
    padding: 6px;
    border-radius: 16px;
    background: var(--bg-surface);
    box-shadow: var(--shadow);
    border: 1px solid var(--hairline);
  }

  .caption {
    margin: 6px 10px 8px;
    color: var(--text-tertiary);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 9px 10px;
    border-radius: 10px;
    color: var(--text-primary);
    font-size: 14px;
    text-align: left;
  }

  .option:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
</style>
