<script lang="ts">
  import { ChevronLeft } from "@lucide/svelte";

  interface Props {
    label: string;
    onclick: () => void;
  }
  let { label, onclick }: Props = $props();
</script>

<button {onclick}>
  <ChevronLeft size={17} strokeWidth={2.4} />
  <span>{label}</span>
</button>

<style>
  button {
    position: absolute;
    top: 20px;
    left: 24px;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 9px 16px 9px 12px;
    border-radius: var(--radius-pill);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    box-shadow: var(--shadow);
    transition: all 140ms var(--ease);
  }

  button:hover {
    background: var(--accent-soft);
    color: var(--accent);
    transform: translateX(-2px);
  }
</style>
