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
      <Glyph size={13} strokeWidth={2.2} />
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
    min-width: 24px;
    height: 24px;
    padding: 0 7px;
    border-radius: 7px;
    background: var(--bg-raised);
    color: var(--text-secondary);
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
  }

  kbd.onAccent {
    background: rgba(255, 255, 255, 0.22);
    color: inherit;
  }
</style>
