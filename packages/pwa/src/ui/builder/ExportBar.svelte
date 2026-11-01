<script lang="ts">
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import { ChevronDown, Download, MessageCircle, QrCode } from "@lucide/svelte";
  import type { CompositionSession } from "../../application/compositionSession.svelte.js";
  import { whatsappLink, type ShareRoute } from "../../application/share.js";
  import { download } from "../../application/workoutFile.js";
  import { stepMeasure } from "../../i18n/format.js";
  import { keys } from "../../i18n/keys.svelte.js";
  import { t } from "../../i18n/locale.svelte.js";
  import InstallHelp from "../InstallHelp.svelte";
  import Kbd from "../Kbd.svelte";
  import SendPanel from "../SendPanel.svelte";
  import { menuKeydown } from "../menuKeys.js";
  import { ms } from "../motion.js";
  import { toasts } from "../toast.svelte.js";

  const HELP_KEY = "dotworkout.installHelpSeen";

  interface Props {
    session: CompositionSession;
  }
  let { session }: Props = $props();

  let menu = $state(false);
  let shareButton = $state<HTMLButtonElement | undefined>(undefined);
  let shareItems = $state<HTMLButtonElement[]>([]);
  let sending = $state(false);
  let helping = $state<ShareRoute | undefined>(undefined);
  let root = $state<HTMLDivElement | undefined>(undefined);

  let empty = $derived(session.steps.length === 0);

  /**
   * Whether the workout can leave as it is. A step still waiting on a value is
   * opened at that field rather than greying out the button with no reason.
   */
  function ready(): boolean {
    if (empty) return false;
    if (session.attendToUnfinished()) {
      toasts.show(t("builder.unfinished"), "warn");
      return false;
    }
    const problem = session.preview.validation?.errors[0];
    if (problem !== undefined) {
      toasts.show(problem.message, "warn");
      return false;
    }
    return true;
  }

  function offerHelp(route: ShareRoute) {
    try {
      if (localStorage.getItem(HELP_KEY) === "1") return;
    } catch {
      return;
    }
    helping = route;
  }

  function closeHelp(suppress: boolean) {
    helping = undefined;
    if (!suppress) return;
    try {
      localStorage.setItem(HELP_KEY, "1");
    } catch {
      return;
    }
  }

  export function save() {
    if (!ready()) return;
    toasts.show(t("rail.saved", { file: download(session.workout) }), "success");
    offerHelp("download");
  }

  function whatsapp() {
    menu = false;
    if (!ready()) return;
    const summary = session.blocks
      .map(stepMeasure)
      .filter((part) => part !== "")
      .join(" · ");
    window.open(whatsappLink(session.workout, summary), "_blank", "noopener");
    offerHelp("chat");
  }

  function scan() {
    menu = false;
    if (ready()) sending = true;
  }

  function openShare() {
    menu = true;
    void tick().then(() => shareItems[0]?.focus());
  }

  function closeShare(refocus: boolean) {
    menu = false;
    if (refocus) shareButton?.focus();
  }

  function away(event: MouseEvent) {
    if (menu && root !== undefined && !root.contains(event.target as Node)) menu = false;
  }
</script>

<svelte:window onclick={away} />

<div class="export" bind:this={root}>
  <div class="share">
    <button
      bind:this={shareButton}
      type="button"
      class="secondary"
      aria-haspopup="menu"
      aria-expanded={menu}
      disabled={empty}
      onclick={() => (menu ? closeShare(false) : openShare())}
      onkeydown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          openShare();
        }
      }}
    >
      {t("builder.share")}
      <ChevronDown size={14} strokeWidth={2} />
    </button>
    {#if menu}
      <div
        class="popover"
        role="menu"
        tabindex="-1"
        transition:fly={{ y: -4, duration: ms(140) }}
        onkeydown={(event) => menuKeydown(event, shareItems, closeShare)}
      >
        <button bind:this={shareItems[0]} type="button" role="menuitem" onclick={whatsapp}>
          <MessageCircle size={15} strokeWidth={2} />
          {t("builder.whatsapp")}
        </button>
        <button bind:this={shareItems[1]} type="button" role="menuitem" onclick={scan}>
          <QrCode size={15} strokeWidth={2} />
          {t("rail.scan")}
        </button>
      </div>
    {/if}
  </div>

  <button type="button" class="primary" disabled={empty} onclick={save}>
    <Download size={15} strokeWidth={2} />
    {t("rail.download")}
    <span class="shortcut"><Kbd label={keys.save} tone="onAccent" /></span>
  </button>
</div>

{#if sending}
  <SendPanel draft={session.workout} onclose={() => (sending = false)} />
{/if}
{#if helping}
  <InstallHelp source={helping} onclose={closeHelp} />
{/if}

<style>
  .export {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .share {
    position: relative;
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 32px;
    border-radius: var(--radius-control);
    font-size: 13.5px;
    font-weight: 600;
    white-space: nowrap;
    transition:
      background 100ms var(--ease),
      opacity 100ms var(--ease);
  }

  .primary {
    padding: 0 6px 0 12px;
    background: var(--ink);
    color: var(--on-ink);
  }

  .primary:hover:not(:disabled) {
    background: var(--ink-hover);
  }

  .secondary {
    padding: 0 10px 0 12px;
    border: 1px solid var(--hairline-strong);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-weight: 500;
  }

  .secondary:hover:not(:disabled) {
    background: var(--bg-raised);
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 40;
    min-width: 200px;
    padding: 4px;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--bg-surface);
    box-shadow: var(--shadow-pop);
  }

  [role="menuitem"] {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 14px;
    text-align: left;
  }

  .popover:focus {
    outline: none;
  }

  [role="menuitem"]:hover,
  [role="menuitem"]:focus-visible {
    outline: none;
    background: var(--bg-raised);
  }

  [role="menuitem"] :global(svg) {
    color: var(--text-secondary);
  }

  /* On a phone the actions leave the top bar and sit at the bottom of the
     screen, under the thumb, with the download taking most of the width. */
  @media (max-width: 760px) {
    .export {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 15;
      padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
      border-top: 1px solid var(--hairline);
      background: var(--bg-surface);
      flex-direction: row-reverse;
    }

    .primary {
      flex: 1;
      height: 44px;
      padding: 0 16px;
      font-size: 15px;
    }

    .secondary {
      height: 44px;
      padding: 0 14px;
    }

    .shortcut {
      display: none;
    }

    .popover {
      top: auto;
      bottom: calc(100% + 8px);
    }
  }
</style>
