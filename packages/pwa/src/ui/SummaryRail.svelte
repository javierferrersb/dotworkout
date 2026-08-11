<script lang="ts">
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { Download, QrCode, Share2 } from "@lucide/svelte";
  import { formatDistance } from "@dotworkout/domain";
  import type { CompositionSession } from "../application/compositionSession.svelte.js";
  import { shareWorkout, whatsappLink } from "../application/share.js";
  import { download } from "../application/workoutFile.js";
  import { alertSummary, blockKindName, blockSummary } from "../i18n/format.js";
  import { t } from "../i18n/locale.svelte.js";
  import InstallHelp from "./InstallHelp.svelte";
  import SendPanel from "./SendPanel.svelte";
  import { SAVE_HINT } from "./platform.js";

  const HELP_KEY = "dotworkout.installHelpSeen";

  interface Props {
    session: CompositionSession;
  }
  let { session }: Props = $props();

  let totals = $derived(session.preview.totals);
  let validation = $derived(session.preview.validation);
  let blocked = $derived(session.blocks.length === 0 || (validation?.errors.length ?? 0) > 0);
  let notice = $state<string | undefined>(undefined);
  let sending = $state(false);
  let helping = $state(false);

  function flash(message: string) {
    notice = message;
    setTimeout(() => (notice = undefined), 2600);
  }

  function offerHelp() {
    if (localStorage.getItem(HELP_KEY) === "1") return;
    helping = true;
  }

  function closeHelp(suppress: boolean) {
    helping = false;
    if (suppress) localStorage.setItem(HELP_KEY, "1");
  }

  export function save() {
    if (blocked) return;
    flash(t("rail.saved", { file: download(session.workout) }));
    offerHelp();
  }

  async function share() {
    if (blocked) return;
    const outcome = await shareWorkout(session.workout);
    if (outcome === "cancelled") return;
    if (outcome === "unavailable") {
      download(session.workout);
    }
    offerHelp();
  }

  function openWhatsapp() {
    const summary = session.blocks.map((block) => blockSummary(block)).join(" · ");
    window.open(whatsappLink(session.workout, summary), "_blank", "noopener");
    offerHelp();
  }
</script>

<aside>
  <header>
    <input class="title" bind:value={session.title} aria-label={t("rail.name")} />
    <p class="activity">{session.activityName}</p>
  </header>

  <div class="blocks">
    {#each session.blocks as block, index (block)}
      <button
        class="card"
        class:on={index === session.cursor}
        onclick={() => session.goToBlock(index)}
        animate:flip={{ duration: 260 }}
        in:fly={{ y: 12, duration: 240 }}
      >
        <div class="row">
          <span class="kind">{block.kind ? blockKindName(block.kind) : t("kind.INTERVAL")}</span>
          {#if block.repetitions && block.repetitions > 1}
            <span class="reps">×{block.repetitions}</span>
          {/if}
        </div>
        <div class="row">
          {#if block.label}<span class="name">{block.label}</span>{/if}
          <span class="measure" class:alone={!block.label}>{blockSummary(block)}</span>
        </div>
        {#if block.alert}
          <div class="row"><span class="target">{alertSummary(block)}</span></div>
        {/if}
      </button>
    {/each}

    {#if session.blocks.length === 0}
      <p class="empty">{t("rail.empty")}</p>
    {/if}
  </div>

  <div class="foot">
    {#if validation && validation.errors.length > 0}
      {#each validation.errors.slice(0, 2) as issue (issue.code + issue.path)}
        <p class="error">{issue.message}</p>
      {/each}
    {/if}

    {#if totals}
      <div class="total">
        <span class="word">{t("rail.total")}</span>
        <span class="amount">
          {totals.total.byUnit.length === 0
            ? "—"
            : totals.total.byUnit.map(formatDistance).join(" + ")}
        </span>
      </div>
      {#if totals.byLabel.length > 0}
        <div class="chips">
          {#each totals.byLabel as entry (entry.label)}
            <span class="chip">{entry.label} <b>{Math.round(entry.total.meters)}</b></span>
          {/each}
        </div>
      {/if}
    {/if}

    <div class="actions">
      <button class="primary" disabled={blocked} onclick={save}>
        <Download size={17} strokeWidth={2.2} />
        {t("rail.download")}
        <kbd>{SAVE_HINT}</kbd>
      </button>

      <button class="secondary" disabled={blocked} onclick={() => (sending = true)}>
        <QrCode size={16} strokeWidth={2.2} />
        {t("rail.scan")}
      </button>

      <div class="pair">
        <button class="whatsapp" disabled={blocked} onclick={openWhatsapp}>
          {t("rail.whatsapp")}
        </button>
        <button class="icon" disabled={blocked} onclick={share} aria-label={t("rail.share")}>
          <Share2 size={17} strokeWidth={2.2} />
        </button>
      </div>
    </div>

    {#if notice}
      <p class="notice" transition:fly={{ y: 6, duration: 200 }}>{notice}</p>
    {:else}
      <p class="privacy">{t("rail.privacy")}</p>
    {/if}
  </div>

  {#if sending}
    <SendPanel draft={session.workout} onclose={() => (sending = false)} />
  {/if}
  {#if helping}
    <InstallHelp onclose={closeHelp} />
  {/if}
</aside>

<style>
  aside {
    width: 380px;
    flex: none;
    height: 100%;
    padding: 26px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--bg-sunken);
    overflow: hidden;
  }

  header {
    padding: 0 4px;
  }

  .title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.6px;
    width: 100%;
    padding: 0;
  }

  .activity {
    margin: 2px 0 0;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .blocks {
    display: grid;
    gap: 8px;
    align-content: start;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
    padding-right: 2px;
  }

  .card {
    background: var(--bg-surface);
    border: 1px solid transparent;
    border-radius: 16px;
    padding: 12px 14px;
    display: grid;
    gap: 4px;
    text-align: left;
    width: 100%;
    transition: all 140ms var(--ease);
  }

  .card:hover {
    border-color: var(--hairline);
  }

  .card.on {
    background: var(--accent-soft);
    border-color: var(--accent-edge);
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .kind {
    font-size: 13px;
    font-weight: 600;
    flex: 1;
    color: var(--text-secondary);
  }

  .reps {
    color: var(--accent);
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 600;
  }

  .name {
    flex: 1;
    font-size: 15px;
  }

  .measure {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text-secondary);
  }

  .measure.alone {
    flex: 1;
    color: var(--text-primary);
    font-size: 15px;
  }

  .target {
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .empty {
    color: var(--text-tertiary);
    font-size: 13px;
    padding: 4px;
    margin: 0;
  }

  .foot {
    display: grid;
    gap: 10px;
  }

  .error {
    margin: 0;
    color: var(--danger);
    font-size: 12px;
    line-height: 1.4;
  }

  .total {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0 4px;
  }

  .word {
    color: var(--text-secondary);
    font-size: 14px;
  }

  .amount {
    font-family: var(--mono);
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.7px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 4px;
  }

  .chip {
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: var(--bg-raised);
    color: var(--text-secondary);
    font-size: 11px;
  }

  .chip b {
    font-family: var(--mono);
    font-weight: 400;
    color: var(--text-tertiary);
  }

  .actions {
    display: grid;
    gap: 8px;
  }

  .pair {
    display: flex;
    gap: 8px;
  }

  .primary,
  .secondary,
  .whatsapp,
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    border-radius: var(--radius-pill);
    font-weight: 600;
    transition: background 140ms var(--ease);
  }

  .primary {
    padding: 14px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 15px;
  }

  .primary kbd {
    padding: 2px 7px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.22);
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 500;
  }

  .secondary {
    padding: 11px;
    background: var(--bg-raised);
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
  }

  .secondary:hover:not(:disabled) {
    background: var(--bg-surface);
  }

  .whatsapp {
    flex: 1;
    padding: 11px;
    background: var(--whatsapp);
    color: var(--on-whatsapp);
    font-size: 14px;
  }

  .whatsapp:hover:not(:disabled) {
    background: var(--whatsapp-hover);
  }

  .icon {
    flex: none;
    width: 44px;
    padding: 11px 0;
    background: var(--bg-raised);
    color: var(--text-primary);
  }

  .icon:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent);
  }

  button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .notice,
  .privacy {
    margin: 0;
    text-align: center;
    font-size: 11px;
  }

  .notice {
    color: var(--lime);
  }

  .privacy {
    color: var(--text-tertiary);
  }

  @media (max-width: 940px) {
    aside {
      width: 100%;
      height: auto;
      border-top: 1px solid var(--hairline);
      padding: 18px 16px 24px;
    }

    .blocks {
      flex: none;
      max-height: 42vh;
    }
  }

  @media (max-width: 640px) {
    .primary kbd {
      display: none;
    }

    .amount {
      font-size: 22px;
    }
  }
</style>