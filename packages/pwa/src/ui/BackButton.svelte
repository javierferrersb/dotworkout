<script lang="ts">
  import { ChevronLeft } from "@lucide/svelte";

  interface Props {
    label: string;
    onclick: () => void;
    /** In a toolbar rather than floating over the page. */
    inline?: boolean;
  }
  let { label, onclick, inline = false }: Props = $props();
</script>

<button {onclick} class:inline>
  <ChevronLeft size={16} strokeWidth={2} />
  <span>{label}</span>
</button>

<style>
  button {
    position: absolute;
    top: 16px;
    left: 20px;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 6px 10px 6px 6px;
    border-radius: var(--radius-control);
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    transition:
      background 120ms var(--ease),
      color 120ms var(--ease);
  }

  button.inline {
    position: static;
  }

  button:hover {
    background: var(--bg-raised);
    color: var(--text-primary);
  }

  @media (max-width: 640px) {
    button {
      left: 10px;
    }
  }
</style>
