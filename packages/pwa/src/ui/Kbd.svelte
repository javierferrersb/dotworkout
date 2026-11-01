<script lang="ts">
  import { ArrowDown, ArrowUp, CornerDownLeft } from "@lucide/svelte";

  interface Props {
    label: string;
    tone?: "default" | "onAccent";
  }
  let { label, tone = "default" }: Props = $props();

  const GLYPHS = { "↑": ArrowUp, "↓": ArrowDown, "⏎": CornerDownLeft } as const;
  let parts = $derived(label.split(" ").filter((part) => part !== ""));
</script>

<kbd class:onAccent={tone === "onAccent"}>
  {#each parts as part (part)}
    {@const Glyph = GLYPHS[part as keyof typeof GLYPHS]}
    {#if Glyph}
      <Glyph size={12} strokeWidth={2} />
    {:else}
      <span>{part}</span>
    {/if}
  {/each}
</kbd>

<style>
  kbd {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 5px;
    border: 1px solid var(--hairline-strong);
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    justify-content: center;
  }

  kbd.onAccent {
    border-color: transparent;
    background: color-mix(in srgb, currentColor 18%, transparent);
    color: inherit;
  }
</style>
