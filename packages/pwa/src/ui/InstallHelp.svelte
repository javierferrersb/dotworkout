<script lang="ts">
  import { fly } from "svelte/transition";
  import { Info } from "@lucide/svelte";
  import type { ShareRoute } from "../application/share.js";
  import { t } from "../i18n/locale.svelte.js";
  import type { MessageKey } from "../i18n/messages.js";

  interface Props {
    source: ShareRoute;
    onclose: (suppress: boolean) => void;
  }
  let { source, onclose }: Props = $props();

  let suppress = $state(false);

  const ROUTES: Record<ShareRoute, readonly MessageKey[]> = {
    download: ["install.download.step1", "install.download.step2", "install.download.step3"],
    chat: ["install.chat.step1", "install.chat.step2"],
  };

  let steps = $derived(ROUTES[source]);
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && onclose(suppress)} />

<div class="scrim">
  <button class="dismiss" onclick={() => onclose(suppress)} aria-label="Close"></button>

  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label={t("install.heading")}
    transition:fly={{ y: 12, duration: 220 }}
  >
    <h2>{t("install.heading")}</h2>

    <ol>
      {#each steps as step, index (step)}
        <li>
          <span class="n">{index + 1}</span>
          <span>{t(step)}</span>
        </li>
      {/each}
    </ol>

    <p class="reopen">
      <Info size={15} strokeWidth={2.2} />
      <span>{t("install.reopen")}</span>
    </p>

    <label class="suppress">
      <input type="checkbox" bind:checked={suppress} />
      <span>{t("install.dontShow")}</span>
    </label>

    <button class="close" onclick={() => onclose(suppress)}>{t("install.gotIt")}</button>
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
    z-index: 25;
  }

  .dismiss {
    position: absolute;
    inset: 0;
    cursor: default;
  }

  .sheet {
    position: relative;
    width: min(400px, 100%);
    background: var(--bg-surface);
    border-radius: var(--radius-card);
    padding: 24px;
    display: grid;
    gap: 16px;
    box-shadow: var(--shadow);
  }

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.4px;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 14px;
  }

  li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  .n {
    display: grid;
    place-items: center;
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
  }

  .reopen {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0;
    padding: 11px 13px;
    border-radius: var(--radius-control);
    background: var(--bg-raised);
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.45;
  }

  .reopen :global(svg) {
    flex: none;
    margin-top: 1px;
    color: var(--accent);
  }

  .suppress {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--text-tertiary);
    font-size: 13px;
    cursor: pointer;
  }

  .suppress input {
    accent-color: var(--accent);
    width: 15px;
    height: 15px;
  }

  .close {
    padding: 13px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-size: 15px;
    font-weight: 600;
  }
</style>
