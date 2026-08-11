<script lang="ts">
  import { fly } from "svelte/transition";
  import { Search } from "@lucide/svelte";
  import { ACTIVITY_CATALOGUE, capabilitiesOf, type Activity } from "../domain/activity.js";
  import { activityName } from "../i18n/format.js";
  import { t } from "../i18n/locale.svelte.js";
  import BackButton from "./BackButton.svelte";

  interface Props {
    onpick: (activity: Activity) => void;
    onback: () => void;
  }
  let { onpick, onback }: Props = $props();

  let query = $state("");
  let highlighted = $state(0);
  let field = $state<HTMLInputElement | undefined>(undefined);

  let matches = $derived(
    ACTIVITY_CATALOGUE.filter((activity) =>
      activityName(activity.id).toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );

  $effect(() => {
    matches.length;
    highlighted = 0;
  });

  $effect(() => {
    field?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlighted = Math.min(matches.length - 1, highlighted + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlighted = Math.max(0, highlighted - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = matches[highlighted];
      if (chosen !== undefined) onpick(chosen);
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (query !== "") query = "";
      else onback();
    }
  }

  function summary(activity: Activity): string {
    const capabilities = capabilitiesOf(activity);
    const targets = capabilities.alerts.length + capabilities.unverifiedAlerts.length;
    const goals = t("picker.goalTypes", { count: capabilities.goals.length });
    const targetText =
      targets === 1 ? t("picker.target", { count: targets }) : t("picker.targets", { count: targets });
    return `${goals} · ${targetText}`;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<BackButton label={t("resume.ok")} onclick={onback} />

<div class="picker">
  <div class="panel" in:fly={{ y: 14, duration: 360 }}>
    <h1>{t("picker.heading")}</h1>

    <div class="search">
      <Search size={19} strokeWidth={2.2} />
      <input
        bind:this={field}
        bind:value={query}
        placeholder={t("picker.search")}
        aria-label={t("picker.search")}
        spellcheck="false"
      />
    </div>

    <ul>
      {#each matches as activity, index (activity.id)}
        <li>
          <button
            class="row"
            class:on={index === highlighted}
            onmouseenter={() => (highlighted = index)}
            onclick={() => onpick(activity)}
          >
            <span class="title">{activityName(activity.id)}</span>
            <span class="detail">{summary(activity)}</span>
          </button>
        </li>
      {/each}
      {#if matches.length === 0}
        <li class="none">{t("picker.noMatch", { query })}</li>
      {/if}
    </ul>
  </div>
</div>

<style>
  .picker {
    height: 100%;
    display: grid;
    place-items: start center;
    padding: 12vh 24px 32px;
    overflow-y: auto;
  }

  .panel {
    width: min(560px, 100%);
  }

  h1 {
    margin: 0 0 22px;
    font-size: clamp(24px, 5vw, 30px);
    font-weight: 700;
    letter-spacing: -0.8px;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 15px 18px;
    border-radius: var(--radius-control);
    background: var(--bg-surface);
    color: var(--text-tertiary);
    box-shadow: var(--shadow);
  }

  input {
    flex: 1;
    font-size: 18px;
    min-width: 0;
    color: var(--text-primary);
  }

  input::placeholder {
    color: var(--text-tertiary);
  }

  ul {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    display: grid;
    gap: 3px;
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 14px;
    width: 100%;
    padding: 14px 16px;
    border-radius: var(--radius-control);
    text-align: left;
    transition: background 120ms var(--ease);
  }

  .row.on {
    background: var(--accent-soft);
  }

  .title {
    flex: 1;
    font-size: 16px;
  }

  .row.on .title {
    color: var(--accent);
    font-weight: 600;
  }

  .detail {
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .none {
    padding: 14px 16px;
    color: var(--text-tertiary);
    font-size: 14px;
  }

  @media (max-width: 640px) {
    .picker {
      padding: 84px 18px 28px;
    }

    .row {
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
    }
  }
</style>
