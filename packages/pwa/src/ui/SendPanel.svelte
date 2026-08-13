<script lang="ts">
  import { fly } from "svelte/transition";
  import { Check, Copy, TriangleAlert } from "@lucide/svelte";
  import { qrMatrix, workoutLink } from "../application/share.js";
  import type { WorkoutDraft } from "../application/workoutComposition.js";
  import { t } from "../i18n/locale.svelte.js";
  import { modals } from "./modal.svelte.js";

  interface Props {
    draft: WorkoutDraft;
    onclose: () => void;
  }
  let { draft, onclose }: Props = $props();

  let link = $derived(workoutLink(draft));
  let matrix = $derived.by(() => {
    try {
      return qrMatrix(link);
    } catch {
      return undefined;
    }
  });
  let copied = $state(false);
  let unreachable = $derived(/^https?:\/\/(localhost|127\.0\.0\.1)/.test(link));

  async function copy() {
    await navigator.clipboard.writeText(link);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  $effect(() => modals.enter());
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && onclose()} />

<div class="scrim">
  <button class="dismiss" onclick={onclose} aria-label="Close"></button>

  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label={t("send.heading")}
    transition:fly={{ y: 12, duration: 220 }}
  >
    <h2>{t("send.heading")}</h2>
    <p class="body">{t("send.body")}</p>

    {#if matrix}
      <div class="qr" style="--cells:{matrix.length}">
        {#each matrix as row, y (y)}
          {#each row as dark, x (x)}
            <i class:dark></i>
          {/each}
        {/each}
      </div>
    {:else}
      <p class="alert">
        <TriangleAlert size={16} />
        <span>{t("send.tooBig")}</span>
      </p>
    {/if}

    {#if unreachable}
      <p class="alert">
        <TriangleAlert size={16} />
        <span>{t("send.localhost")}</span>
      </p>
    {/if}

    <button class="copy" onclick={copy}>
      {#if copied}
        <Check size={16} /> {t("send.copied")}
      {:else}
        <Copy size={16} /> {t("send.copy")}
      {/if}
    </button>

    <button class="close" onclick={onclose}>{t("send.done")}</button>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: grid;
    place-items: center;
    padding: 24px;
    z-index: 20;
  }

  .dismiss {
    position: absolute;
    inset: 0;
    cursor: default;
  }

  .sheet {
    position: relative;
    width: min(360px, 100%);
    background: var(--bg-surface);
    border-radius: var(--radius-card);
    padding: 24px;
    display: grid;
    gap: 12px;
    box-shadow: var(--shadow);
  }

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.4px;
  }

  .body {
    margin: 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.45;
  }

  .qr {
    display: grid;
    grid-template-columns: repeat(var(--cells), 1fr);
    width: 100%;
    max-width: 260px;
    aspect-ratio: 1;
    margin: 2px auto;
    padding: 14px;
    background: #ffffff;
    border-radius: 14px;
  }

  .qr i {
    background: transparent;
  }

  .qr i.dark {
    background: #000000;
  }

  .alert {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin: 0;
    padding: 11px 13px;
    border-radius: var(--radius-control);
    background: var(--bg-raised);
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.45;
  }

  .alert :global(svg) {
    flex: none;
    margin-top: 1px;
    color: var(--danger);
  }

  .copy,
  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
  }

  .copy {
    background: var(--bg-raised);
    color: var(--text-primary);
  }

  .close {
    background: var(--accent);
    color: var(--on-accent);
  }
</style>
