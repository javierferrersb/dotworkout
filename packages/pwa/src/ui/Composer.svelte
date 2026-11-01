<script lang="ts">
  import { tick } from "svelte";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { Info, Languages, Monitor, Moon, Plus, Sun } from "@lucide/svelte";
  import { toMeters } from "@dotworkout/domain";
  import { numberText } from "../application/stepEdit.js";
  import type { ThemeChoice } from "../application/appFlow.svelte.js";
  import type { CompositionSession } from "../application/compositionSession.svelte.js";
  import type { BlockKind } from "../domain/block.js";
  import { blockKindName } from "../i18n/format.js";
  import { keys } from "../i18n/keys.svelte.js";
  import { locale, t } from "../i18n/locale.svelte.js";
  import { LOCALES, type LocaleCode, type MessageKey } from "../i18n/messages.js";
  import About from "./About.svelte";
  import BackButton from "./BackButton.svelte";
  import ExportBar from "./builder/ExportBar.svelte";
  import StepRow from "./builder/StepRow.svelte";
  import StructureStrip from "./builder/StructureStrip.svelte";
  import Kbd from "./Kbd.svelte";
  import Menu from "./Menu.svelte";
  import { modals } from "./modal.svelte.js";
  import { ms } from "./motion.js";
  import { toasts } from "./toast.svelte.js";

  interface Props {
    session: CompositionSession;
    themeChoice: ThemeChoice;
    onback: () => void;
    ontheme: (choice: ThemeChoice) => void;
  }
  let { session, themeChoice, onback, ontheme }: Props = $props();

  const KINDS: readonly BlockKind[] = ["WARMUP", "INTERVAL", "RECOVERY", "COOLDOWN"];

  let exporter = $state<ExportBar | undefined>(undefined);
  let about = $state(false);

  let addable = $derived(KINDS.filter((kind) => session.canAdd(kind)));
  let count = $derived(session.steps.length);
  let totals = $derived(session.preview.totals);
  // One figure in the sport's own unit, however the steps were typed.
  let totalText = $derived.by(() => {
    if (totals === undefined || totals.total.byUnit.length === 0) return "";
    const metres = totals.total.byUnit.reduce((sum, distance) => sum + toMeters(distance), 0);
    const unit = session.activity.defaultDistanceUnit;
    const value = metres / toMeters({ value: 1, unit });
    return `${numberText(Math.round(value * 100) / 100)} ${unit}`;
  });
  let defaultTitle = $derived(t("naming.defaultTitle", { activity: session.activityName }));

  let themeOptions = $derived([
    { value: "system", label: t("theme.system") },
    { value: "light", label: t("theme.light") },
    { value: "dark", label: t("theme.dark") },
  ]);
  let localeOptions = $derived(LOCALES.map((entry) => ({ value: entry.code, label: entry.label })));

  let legend = $derived([
    { key: KINDS.map((kind) => kindKey(kind)).join(" "), what: t("legend.add") },
    { key: `${keys.up} ${keys.down}`, what: t("legend.steps") },
    { key: keys.enter, what: t("legend.next") },
    { key: keys.escape, what: t("legend.close") },
    { key: `${keys.primary}${keys.primary === "⌘" ? "" : "+"}Z`, what: t("legend.undo") },
    { key: keys.save, what: t("legend.download") },
  ]);

  function kindKey(kind: BlockKind): string {
    return t(`kindKey.${kind}` as MessageKey);
  }

  function focusHead(id: number | undefined) {
    if (id === undefined) return;
    void tick().then(() =>
      document.querySelector<HTMLElement>(`[data-step="${id}"] > .head`)?.focus(),
    );
  }

  function add(kind: BlockKind) {
    session.add(kind);
  }

  function close(id: number) {
    session.close();
    focusHead(id);
  }

  function remove(id: number) {
    const index = session.indexOf(id) ?? 0;
    session.remove(id);
    toasts.show(t("builder.removed"), "info", {
      label: t("builder.undo"),
      run: () => session.undo(),
    });
    const neighbour = session.steps[Math.min(index, session.steps.length - 1)];
    focusHead(neighbour?.id);
  }

  function pick(id: number) {
    session.toggle(id);
    focusHead(id);
  }

  function editing(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    );
  }

  function onKeydown(event: KeyboardEvent) {
    if (modals.any) return;
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const typing = editing(event.target);

    if (meta && key === "s") {
      event.preventDefault();
      exporter?.save();
      return;
    }
    // Inside a field the browser's own undo belongs to the text.
    if (meta && !typing && (key === "z" || key === "y")) {
      event.preventDefault();
      if (key === "y" || event.shiftKey) session.redo();
      else session.undo();
      return;
    }
    if (meta && !typing && key === "d" && session.open !== undefined) {
      event.preventDefault();
      session.duplicate(session.open);
      return;
    }
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      if (session.open === undefined) return;
      event.preventDefault();
      session.move(session.open, event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (typing || meta || event.altKey) return;

    const target = event.target instanceof HTMLElement ? event.target : undefined;
    // The step editor owns its own keys: arrows between fields, Escape to close.
    if (target?.closest(".editor") !== null && target !== undefined) return;

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      focusHead(session.openAdjacent(event.key === "ArrowUp" ? -1 : 1));
      return;
    }
    if (event.key === "Escape") {
      session.close();
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      const row = target?.closest<HTMLElement>("[data-step]");
      if (row !== null && row !== undefined) {
        event.preventDefault();
        remove(Number(row.dataset["step"]));
      }
      return;
    }
    const kind = KINDS.find((candidate) => kindKey(candidate).toLowerCase() === key);
    if (kind !== undefined && session.canAdd(kind)) {
      event.preventDefault();
      add(kind);
    }
  }

  function settleTitle() {
    if (session.title.trim() === "") session.title = defaultTitle;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="builder">
  <nav>
    <BackButton label={t("composer.newWorkout")} onclick={onback} inline />
    <span class="grow"></span>

    <Menu
      label={t("language.label")}
      options={localeOptions}
      selected={locale.code}
      onselect={(value) => locale.set(value as LocaleCode)}
    >
      {#snippet trigger()}
        <Languages size={16} strokeWidth={2} />
        <span class="only-wide">{locale.code.toUpperCase()}</span>
      {/snippet}
    </Menu>

    <Menu
      label={t("theme.label")}
      options={themeOptions}
      selected={themeChoice}
      onselect={(value) => ontheme(value as ThemeChoice)}
    >
      {#snippet trigger()}
        {#if themeChoice === "system"}
          <Monitor size={16} strokeWidth={2} />
        {:else if themeChoice === "light"}
          <Sun size={16} strokeWidth={2} />
        {:else}
          <Moon size={16} strokeWidth={2} />
        {/if}
      {/snippet}
    </Menu>

    <button class="about" onclick={() => (about = true)} aria-label={t("about.open")}>
      <Info size={16} strokeWidth={2} />
    </button>

    <span class="divider" aria-hidden="true"></span>
    <ExportBar bind:this={exporter} {session} />
  </nav>

  <div class="scroll">
    <div class="column">
      <header>
        <input
          class="title"
          bind:value={session.title}
          aria-label={t("rail.name")}
          title={t("naming.lede")}
          placeholder={defaultTitle}
          maxlength="60"
          spellcheck="false"
          onblur={settleTitle}
          onkeydown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <p class="meta">
          <span>{session.activityName}</span>
          {#if count > 0}
            <span class="sep">·</span>
            <span>{count === 1 ? t("builder.step", { count }) : t("builder.steps", { count })}</span
            >
          {/if}
          {#if totalText !== ""}
            <span class="sep">·</span>
            <span class="total">{totalText}</span>
          {/if}
        </p>
      </header>

      {#if count > 0}
        <div class="shape">
          <StructureStrip {session} onpick={pick} />
        </div>

        <ol class="steps">
          {#each session.steps as entry, index (entry.id)}
            <li
              class="slot"
              animate:flip={{ duration: ms(220) }}
              in:fly={{ y: -6, duration: ms(200) }}
            >
              <StepRow {session} {entry} {index} onremove={remove} onclose={close} />
            </li>
          {/each}
        </ol>
      {:else}
        <div class="empty">
          <p class="emptyTitle">{t("builder.empty.title")}</p>
          <p class="emptyBody">{t("builder.empty.body")}</p>
        </div>
      {/if}

      <div class="add" role="group" aria-label={t("builder.add")}>
        {#each addable as kind (kind)}
          <button
            type="button"
            class="addKind"
            class:lead={kind === "INTERVAL"}
            onclick={() => add(kind)}
          >
            <Plus size={14} strokeWidth={2} />
            {blockKindName(kind)}
            <span class="key"><Kbd label={kindKey(kind)} /></span>
          </button>
        {/each}
      </div>

      <p class="privacy">{t("rail.privacy")}</p>
    </div>
  </div>

  <footer class="legend">
    {#each legend as entry (entry.what)}
      <span><Kbd label={entry.key} />{entry.what}</span>
    {/each}
  </footer>
</div>

<div class="toasts" aria-live="polite">
  {#if toasts.current}
    {@const toast = toasts.current}
    {#key toast.id}
      <div class="toast {toast.tone}" transition:fly={{ y: 8, duration: ms(180) }}>
        <span>{toast.message}</span>
        {#if toast.action}
          <button
            type="button"
            onclick={() => {
              toast.action?.run();
              toasts.clear();
            }}
          >
            {toast.action.label}
          </button>
        {/if}
      </div>
    {/key}
  {/if}
</div>

{#if about}
  <About onclose={() => (about = false)} />
{/if}

<style>
  .builder {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  nav {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 56px;
    padding: 0 16px 0 12px;
    border-bottom: 1px solid var(--hairline);
  }

  .grow {
    flex: 1;
  }

  .about {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-control);
    color: var(--text-secondary);
    transition:
      background 120ms var(--ease),
      color 120ms var(--ease);
  }

  .about:hover {
    background: var(--bg-raised);
    color: var(--text-primary);
  }

  .divider {
    width: 1px;
    height: 20px;
    margin: 0 10px 0 8px;
    background: var(--hairline-strong);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .column {
    --label-column: 104px;
    width: min(720px, calc(100% - 32px));
    margin: 0 auto;
    padding: 40px 0 56px;
  }

  header {
    margin-bottom: 20px;
  }

  .title {
    display: block;
    width: calc(100% + 16px);
    margin: 0 -8px;
    padding: 2px 8px;
    border-radius: var(--radius-control);
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.025em;
    line-height: 1.25;
    transition: background 120ms var(--ease);
  }

  .title:hover {
    background: var(--bg-raised);
  }

  .title:focus {
    background: none;
    box-shadow: 0 0 0 2px var(--accent);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 0;
    color: var(--text-secondary);
    font-size: 14px;
  }

  .sep {
    color: var(--text-tertiary);
  }

  .total {
    color: var(--text-primary);
    font-weight: 500;
  }

  .shape {
    margin-bottom: 14px;
  }

  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--hairline);
    border-radius: var(--radius-card);
    background: var(--bg-surface);
    overflow: hidden;
  }

  .slot + .slot {
    border-top: 1px solid var(--hairline);
  }

  .empty {
    padding: 28px 24px;
    border: 1px dashed var(--hairline-strong);
    border-radius: var(--radius-card);
  }

  .emptyTitle {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 600;
  }

  .emptyBody {
    margin: 0;
    max-width: 460px;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  .add {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .addKind {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 6px 0 10px;
    border: 1px solid var(--hairline-strong);
    border-radius: var(--radius-control);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-size: 13.5px;
    font-weight: 500;
    transition: background 100ms var(--ease);
  }

  .addKind:hover {
    background: var(--bg-raised);
  }

  .addKind :global(svg) {
    color: var(--text-secondary);
  }

  .key {
    display: inline-flex;
    margin-left: 4px;
  }

  .privacy {
    margin: 28px 0 0;
    color: var(--text-tertiary);
    font-size: 12.5px;
  }

  .legend {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
    padding: 10px 20px;
    border-top: 1px solid var(--hairline);
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  .toasts {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 64px;
    z-index: 30;
    display: flex;
    justify-content: center;
    padding: 0 16px;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 100%;
    padding: 8px 8px 8px 14px;
    border: 1px solid var(--hairline-strong);
    border-radius: 10px;
    background: var(--bg-surface);
    box-shadow: var(--shadow-pop);
    font-size: 13.5px;
  }

  .toast:not(:has(button)) {
    padding-right: 14px;
  }

  .toast.warn span {
    color: var(--warn);
  }

  .toast.success span {
    color: var(--success);
  }

  .toast button {
    flex: none;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    background: var(--bg-raised);
    color: var(--text-primary);
    font-weight: 600;
  }

  @media (max-width: 760px) {
    nav {
      height: 52px;
      padding: 0 8px 0 4px;
    }

    .divider {
      display: none;
    }

    .column {
      padding: 24px 0 120px;
    }

    .title {
      font-size: 22px;
    }

    .legend,
    .key {
      display: none;
    }

    .addKind {
      height: 40px;
      padding: 0 14px 0 12px;
    }

    .toasts {
      bottom: calc(80px + env(safe-area-inset-bottom));
    }
  }

  @media (max-width: 640px) {
    .only-wide {
      display: none;
    }
  }
</style>
