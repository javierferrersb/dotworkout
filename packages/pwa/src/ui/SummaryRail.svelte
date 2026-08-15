<script lang="ts">
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import {
    ArrowDown,
    ArrowUp,
    ChevronUp,
    Copy,
    Download,
    GripVertical,
    QrCode,
    Share2,
  } from "@lucide/svelte";
  import { formatDistance } from "@dotworkout/domain";
  import type { CompositionSession } from "../application/compositionSession.svelte.js";
  import { whatsappLink, type ShareRoute } from "../application/share.js";
  import { download } from "../application/workoutFile.js";
  import { alertSummary, blockHeading, blockKindName, blockSummary, questionText } from "../i18n/format.js";
  import { t } from "../i18n/locale.svelte.js";
  import InstallHelp from "./InstallHelp.svelte";
  import SendPanel from "./SendPanel.svelte";
  import { keys } from "../i18n/keys.svelte.js";

  const HELP_KEY = "dotworkout.installHelpSeen";

  interface Props {
    session: CompositionSession;
  }
  let { session }: Props = $props();

  let totals = $derived(session.preview.totals);
  let validation = $derived(session.preview.validation);
  let blocked = $derived(
    session.blocks.length === 0 ||
      (validation?.errors.length ?? 0) > 0 ||
      session.unfinished.length > 0,
  );
  let notice = $state<string | undefined>(undefined);
  let sending = $state(false);
  let helping = $state<ShareRoute | undefined>(undefined);
  let expanded = $state(false);
  let titleField = $state<HTMLTextAreaElement | undefined>(undefined);
  let draggingFrom = $state<number | undefined>(undefined);
  let dropAt = $state<number | undefined>(undefined);

  function startDrag(event: DragEvent, index: number) {
    draggingFrom = index;
    if (event.dataTransfer !== null) {
      event.dataTransfer.effectAllowed = "move";
      // Firefox will not start a drag without payload.
      event.dataTransfer.setData("text/plain", String(index));
    }
  }

  function endDrag() {
    draggingFrom = undefined;
    dropAt = undefined;
  }

  let totalText = $derived(
    totals === undefined || totals.total.byUnit.length === 0
      ? "—"
      : totals.total.byUnit.map(formatDistance).join(" + "),
  );

  $effect(() => {
    session.title;
    expanded;
    const field = titleField;
    if (field === undefined) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  });

  function flash(message: string) {
    notice = message;
    setTimeout(() => (notice = undefined), 2600);
  }

  function offerHelp(source: ShareRoute) {
    if (localStorage.getItem(HELP_KEY) === "1") return;
    helping = source;
  }

  function closeHelp(suppress: boolean) {
    helping = undefined;
    if (suppress) localStorage.setItem(HELP_KEY, "1");
  }

  export function save() {
    if (blocked) return;
    flash(t("rail.saved", { file: download(session.workout) }));
    offerHelp("download");
  }

  function openWhatsapp() {
    if (blocked) return;
    const summary = session.blocks.map((block) => blockSummary(block)).join(" · ");
    window.open(whatsappLink(session.workout, summary), "_blank", "noopener");
    offerHelp("chat");
  }
</script>

<aside class:expanded>
  <button class="peek" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
    <span class="peekTotal">{totalText}</span>
    <span class="peekCount">
      {session.blocks.length === 1
        ? t("rail.blockCount", { count: 1 })
        : t("rail.blockCountPlural", { count: session.blocks.length })}
    </span>
    <ChevronUp class="chev" size={18} strokeWidth={2.4} />
  </button>

  <div class="sheet">
    <header>
      <textarea
        class="title"
        bind:this={titleField}
        bind:value={session.title}
        rows="1"
        spellcheck="false"
        aria-label={t("rail.name")}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            titleField?.blur();
          }
        }}
      ></textarea>
      <p class="activity">{session.activityName}</p>
    </header>

    <div class="blocks">
      {#each session.blocks as block, index (block)}
        <div
          class="card"
          class:on={index === session.cursor}
          class:over={dropAt === index && draggingFrom !== undefined && draggingFrom !== index}
          draggable={session.canReorder(index)}
          role="listitem"
          animate:flip={{ duration: 260 }}
          in:fly={{ y: 12, duration: 240 }}
          ondragstart={(event) => startDrag(event, index)}
          ondragover={(event) => {
            event.preventDefault();
            dropAt = index;
          }}
          ondrop={(event) => {
            event.preventDefault();
            if (draggingFrom !== undefined) session.moveBlock(draggingFrom, index);
            endDrag();
          }}
          ondragend={endDrag}
        >
          <button class="pick" onclick={() => session.goToBlock(index)}>
            <span class="row">
              <span class="kind">{block.kind ? blockKindName(block.kind) : t("kind.INTERVAL")}</span>
              {#if block.repetitions && block.repetitions > 1}
                <span class="reps">×{block.repetitions}</span>
              {/if}
            </span>
            <span class="row">
              {#if block.label}<span class="name">{block.label}</span>{/if}
              <span class="measure" class:alone={!block.label}>{blockSummary(block)}</span>
            </span>
            {#if block.alert}
              <span class="row">
                <span class="target">{alertSummary(block, session.activity.sport)}</span>
              </span>
            {/if}
          </button>

          {#if session.canReorder(index)}
            <div class="tools">
              <span class="grip" aria-hidden="true"><GripVertical size={14} strokeWidth={2} /></span>
              <button
                class="tool"
                disabled={!session.canMoveUp(index)}
                aria-label={t("rail.moveUp")}
                onclick={() => session.moveBlock(index, index - 1)}
              >
                <ArrowUp size={14} strokeWidth={2.4} />
              </button>
              <button
                class="tool"
                disabled={!session.canMoveDown(index)}
                aria-label={t("rail.moveDown")}
                onclick={() => session.moveBlock(index, index + 1)}
              >
                <ArrowDown size={14} strokeWidth={2.4} />
              </button>
              <button
                class="tool"
                aria-label={t("rail.duplicate")}
                onclick={() => session.duplicateBlock(index)}
              >
                <Copy size={14} strokeWidth={2.4} />
              </button>
            </div>
          {/if}
        </div>
      {/each}

      {#if session.blocks.length === 0}
        <p class="empty">{t("rail.empty")}</p>
      {/if}
    </div>
  </div>

  <div class="foot">
    {#each session.unfinished.slice(0, 2) as entry (entry.index)}
      <button
        class="error unfinished"
        onclick={() => session.goToBlock(entry.index)}
      >
        {t("rail.unfinished", {
          block: blockHeading(session.blocks[entry.index] ?? {}, entry.index),
          question: questionText(entry.question),
        })}
      </button>
    {/each}

    {#if validation && validation.errors.length > 0}
      {#each validation.errors.slice(0, 2) as issue (issue.code + issue.path)}
        <p class="error">{issue.message}</p>
      {/each}
    {/if}

    <div class="total">
      <span class="word">{t("rail.total")}</span>
      <span class="amount">{totalText}</span>
    </div>

    {#if totals && totals.byLabel.length > 0}
      <div class="chips">
        {#each totals.byLabel as entry (entry.label)}
          <span class="chip">{entry.label} <b>{Math.round(entry.total.meters)}</b></span>
        {/each}
      </div>
    {/if}

    <div class="actions">
      <button class="primary" disabled={blocked} onclick={save}>
        <Download size={17} strokeWidth={2.2} />
        {t("rail.download")}
        <kbd>{keys.save}</kbd>
      </button>

      <div class="pair">
        <button class="whatsapp" disabled={blocked} onclick={openWhatsapp}>
          <Share2 size={16} strokeWidth={2.2} />
          {t("rail.whatsapp")}
        </button>
        <button class="secondary" disabled={blocked} onclick={() => (sending = true)}>
          <QrCode size={16} strokeWidth={2.2} />
          <span class="scanLabel">{t("rail.scan")}</span>
        </button>
      </div>
    </div>

    {#if notice}
      <p class="notice" transition:fly={{ y: 6, duration: 200 }}>{notice}</p>
    {:else}
      <p class="privacy">{t("rail.privacy")}</p>
    {/if}
  </div>
</aside>

{#if sending}
  <SendPanel draft={session.workout} onclose={() => (sending = false)} />
{/if}
{#if helping}
  <InstallHelp source={helping} onclose={closeHelp} />
{/if}

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

  .peek {
    display: none;
  }

  .sheet {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    flex: 1;
  }

  header {
    padding: 0 4px;
  }

  .title {
    font: inherit;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.6px;
    line-height: 1.15;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    resize: none;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .title:focus {
    outline: none;
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
    position: relative;
    background: var(--bg-surface);
    border: 1px solid transparent;
    border-radius: 16px;
    transition: all 140ms var(--ease);
  }

  .card.over {
    border-color: var(--accent);
  }

  .pick {
    display: grid;
    gap: 4px;
    width: 100%;
    padding: 12px 14px;
    text-align: left;
    border-radius: inherit;
  }

  .tools {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: var(--radius-pill);
    background: var(--bg-raised);
    opacity: 0;
    transition: opacity 120ms var(--ease);
  }

  .card:hover .tools,
  .card:focus-within .tools {
    opacity: 1;
  }

  .grip {
    display: grid;
    place-items: center;
    padding: 0 1px;
    color: var(--text-tertiary);
    cursor: grab;
  }

  .tool {
    display: grid;
    place-items: center;
    padding: 4px;
    border-radius: 6px;
    color: var(--text-secondary);
  }

  .tool:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .tool:disabled {
    opacity: 0.3;
    cursor: default;
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
    min-width: 0;
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
    overflow-wrap: anywhere;
  }

  .measure {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
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

  .unfinished {
    width: 100%;
    text-align: left;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .total {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
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
    text-align: right;
    overflow-wrap: anywhere;
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
    overflow-wrap: anywhere;
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
  .whatsapp {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    border-radius: var(--radius-pill);
    font-weight: 600;
    white-space: nowrap;
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

  .secondary {
    flex: 1;
    padding: 11px;
    background: var(--bg-raised);
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
  }

  .secondary:hover:not(:disabled) {
    background: var(--bg-surface);
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
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 15;
      width: 100%;
      height: auto;
      max-height: 88vh;
      padding: 0;
      gap: 0;
      background: var(--bg-surface);
      border-top: 1px solid var(--hairline);
      box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.22);
      border-radius: 20px 20px 0 0;
    }

    .peek {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 14px 18px;
      text-align: left;
    }

    .peekTotal {
      font-family: var(--mono);
      font-size: 17px;
      font-weight: 700;
    }

    .peekCount {
      flex: 1;
      color: var(--text-tertiary);
      font-size: 13px;
    }

    .peek :global(.chev) {
      color: var(--text-tertiary);
      transition: transform 200ms var(--ease);
    }

    aside.expanded .peek :global(.chev) {
      transform: rotate(180deg);
    }

    .sheet {
      display: none;
    }

    aside.expanded .sheet {
      display: flex;
      padding: 0 16px;
      max-height: 52vh;
    }

    .foot {
      padding: 0 16px 18px;
      gap: 8px;
    }

    .total,
    .chips,
    .privacy,
    .notice {
      display: none;
    }

    aside.expanded .total,
    aside.expanded .chips {
      display: flex;
    }

    .tools {
      opacity: 1;
    }

    .grip {
      display: none;
    }

    .primary {
      padding: 13px;
    }

    .primary kbd {
      display: none;
    }
  }
</style>
