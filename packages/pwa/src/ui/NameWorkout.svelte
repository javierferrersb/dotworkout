<script lang="ts">
  import { untrack } from "svelte";
  import { fly } from "svelte/transition";
  import { CornerDownLeft } from "@lucide/svelte";
  import type { Activity } from "../domain/activity.js";
  import { activityName } from "../i18n/format.js";
  import { t } from "../i18n/locale.svelte.js";
  import BackButton from "./BackButton.svelte";

  interface Props {
    activity: Activity;
    initial: string;
    onconfirm: (title: string) => void;
    onback: () => void;
  }
  let { activity, initial, onconfirm, onback }: Props = $props();

  let title = $state(untrack(() => initial));
  let field = $state<HTMLInputElement | undefined>(undefined);

  let fallback = $derived(t("naming.defaultTitle", { activity: activityName(activity.id) }));

  $effect(() => {
    field?.focus();
    field?.select();
  });

  function submit(event: Event) {
    event.preventDefault();
    onconfirm(title.trim() === "" ? fallback : title.trim());
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onback();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<BackButton label={activityName(activity.id)} onclick={onback} />

<div class="naming">
  <div class="panel" in:fly={{ y: 14, duration: 360 }}>
    <p class="eyebrow">{activityName(activity.id)}</p>
    <h1>{t("naming.heading")}</h1>
    <p class="lede">{t("naming.lede")}</p>

    <form onsubmit={submit}>
      <input
        bind:this={field}
        bind:value={title}
        placeholder={fallback}
        aria-label={t("rail.name")}
        spellcheck="false"
        maxlength="60"
      />
      <button type="submit">
        {t("naming.continue")}
        <CornerDownLeft size={14} strokeWidth={2} />
      </button>
    </form>

    <p class="hint">{t("naming.hint")}</p>
  </div>
</div>

<style>
  .naming {
    height: 100%;
    display: grid;
    place-items: center;
    padding: 32px 24px;
    overflow-y: auto;
  }

  .panel {
    width: min(520px, 100%);
  }

  .eyebrow {
    margin: 0 0 8px;
    color: var(--text-tertiary);
    font-size: 13px;
    font-weight: 500;
  }

  h1 {
    margin: 0 0 8px;
    font-size: clamp(24px, 4vw, 30px);
    font-weight: 600;
    letter-spacing: -0.025em;
  }

  .lede {
    margin: 0 0 24px;
    color: var(--text-secondary);
    font-size: 15px;
    line-height: 1.5;
  }

  form {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 14px;
    border: 1px solid var(--hairline-strong);
    border-radius: 10px;
    background: var(--bg-surface);
    transition:
      border-color 120ms var(--ease),
      box-shadow 120ms var(--ease);
  }

  form:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  input {
    flex: 1;
    min-width: 0;
    font-size: 17px;
    padding: 10px 0;
  }

  input::placeholder {
    color: var(--text-tertiary);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 7px;
    background: var(--ink);
    color: var(--on-ink);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    transition: background 120ms var(--ease);
  }

  button:hover {
    background: var(--ink-hover);
  }

  .hint {
    margin: 14px 0 0;
    color: var(--text-tertiary);
    font-size: 13px;
  }

  @media (max-width: 640px) {
    form {
      flex-direction: column;
      align-items: stretch;
      padding: 12px;
      gap: 12px;
    }

    input {
      padding: 4px 0;
    }

    button {
      justify-content: center;
      padding: 12px;
    }
  }
</style>
