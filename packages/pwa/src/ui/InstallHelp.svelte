<script lang="ts">
  import { fly } from "svelte/transition";
  import { t } from "../i18n/locale.svelte.js";

  interface Props {
    onclose: (suppress: boolean) => void;
  }
  let { onclose }: Props = $props();

  let suppress = $state(false);
  const STEPS = ["install.step1", "install.step2", "install.step3"] as const;
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
      {#each STEPS as step, index (step)}
        <li>
          <span class="n">{index + 1}</span>
          <span>{t(step)}</span>
        </li>
      {/each}
    </ol>

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
    width: min(380px, 100%);
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
