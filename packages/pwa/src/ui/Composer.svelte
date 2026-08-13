<script lang="ts">
  import { fly } from "svelte/transition";
  import { Info, Languages, Monitor, Moon, Sun } from "@lucide/svelte";
  import type { ThemeChoice } from "../application/appFlow.svelte.js";
  import type { CompositionSession } from "../application/compositionSession.svelte.js";
  import { choiceKey } from "../i18n/format.js";
  import { locale, t } from "../i18n/locale.svelte.js";
  import { LOCALES, type LocaleCode } from "../i18n/messages.js";
  import BackButton from "./BackButton.svelte";
  import About from "./About.svelte";
  import BlockCard from "./BlockCard.svelte";
  import Kbd from "./Kbd.svelte";
  import Menu from "./Menu.svelte";
  import SummaryRail from "./SummaryRail.svelte";
  import { modals } from "./modal.svelte.js";
  import { keys } from "../i18n/keys.svelte.js";

  interface Props {
    session: CompositionSession;
    themeChoice: ThemeChoice;
    onback: () => void;
    ontheme: (choice: ThemeChoice) => void;
  }
  let { session, themeChoice, onback, ontheme }: Props = $props();

  let card = $state<BlockCard | undefined>(undefined);
  let rail = $state<SummaryRail | undefined>(undefined);
  let about = $state(false);

  let legend = $derived([
    { key: `${keys.up} ${keys.down}`, what: t("composer.legend.question") },
    { key: `${keys.blockUp} / ${keys.blockDown}`, what: t("composer.legend.block") },
    { key: keys.enter, what: t("composer.legend.confirm") },
    { key: keys.tab, what: t("composer.legend.skip") },
    { key: keys.escape, what: t("composer.legend.deselect") },
  ]);

  let themeOptions = $derived([
    { value: "system", label: t("theme.system") },
    { value: "light", label: t("theme.light") },
    { value: "dark", label: t("theme.dark") },
  ]);

  let localeOptions = $derived(LOCALES.map((entry) => ({ value: entry.code, label: entry.label })));

  function typing(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  }

  function onKeydown(event: KeyboardEvent) {
    if (modals.any) return;
    const meta = event.metaKey || event.ctrlKey;

    if (meta && event.key.toLowerCase() === "s") {
      event.preventDefault();
      rail?.save();
      return;
    }
    if (meta && event.key === "Enter") {
      event.preventDefault();
      session.commitBlock();
      return;
    }
    if (event.key === "Enter" && !typing(event.target) && session.current?.optional === true) {
      event.preventDefault();
      session.skip(session.current.id);
      return;
    }
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !typing(event.target) &&
      session.current === undefined &&
      session.complete
    ) {
      event.preventDefault();
      session.commitBlock();
      return;
    }
    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      session.previousBlock();
      return;
    }
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      session.nextBlock();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      session.deselect();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      return;
    }
    if (event.key === "Tab" && session.current?.optional === true) {
      event.preventDefault();
      session.skip(session.current.id);
      return;
    }
    if (event.key === "ArrowUp" && !typing(event.target)) {
      event.preventDefault();
      session.previousQuestion();
      return;
    }
    if (event.key === "ArrowDown" && !typing(event.target)) {
      event.preventDefault();
      session.nextQuestion();
      return;
    }

    if (typing(event.target)) return;

    const question = session.current;
    if (question === undefined || question.form.type !== "choice") return;
    if (meta || event.altKey) return;
    const choice = question.form.choices.find(
      (candidate) =>
        choiceKey(candidate, session.activity.id).toLowerCase() === event.key.toLowerCase(),
    );
    if (choice !== undefined) {
      event.preventDefault();
      card?.pressKey(choice.value);
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<main>
  <section class="stage">
    <BackButton label={t("composer.newWorkout")} onclick={onback} />
    <nav>
      <span class="grow"></span>

      <Menu
        label={t("language.label")}
        options={localeOptions}
        selected={locale.code}
        onselect={(value) => locale.set(value as LocaleCode)}
      >
        {#snippet trigger()}
          <Languages size={16} strokeWidth={2.2} />
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
            <Monitor size={16} strokeWidth={2.2} />
          {:else if themeChoice === "light"}
            <Sun size={16} strokeWidth={2.2} />
          {:else}
            <Moon size={16} strokeWidth={2.2} />
          {/if}
        {/snippet}
      </Menu>

      <button class="mark" onclick={() => (about = true)} aria-label={t("about.open")}>
        <img src="/favicon.svg" alt="" width="20" height="20" />
        <Info size={13} strokeWidth={2.6} />
      </button>
    </nav>

    <div class="scroll">
      <div class="column">
        {#key session.cursor}
          <div in:fly={{ y: 18, duration: 300 }}>
            <BlockCard bind:this={card} {session} />
          </div>
        {/key}
      </div>
    </div>

    <footer>
      {#each legend as entry (entry.key)}
        <span class="legend"><Kbd label={entry.key} />{entry.what}</span>
      {/each}
    </footer>
  </section>

  <SummaryRail bind:this={rail} {session} />
</main>

{#if about}
  <About onclose={() => (about = false)} />
{/if}

<style>
  main {
    display: flex;
    height: 100%;
  }

  .stage {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 20px 24px 0;
    min-height: 42px;
  }

  .grow {
    flex: 1;
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: center;
    padding: 24px 32px;
  }

  .column {
    width: min(680px, 100%);
    margin: 0 auto;
  }

  .mark {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: none;
    padding: 5px 8px 5px 6px;
    margin-left: 4px;
    border-radius: var(--radius-pill);
    color: var(--text-tertiary);
    transition: all 140ms var(--ease);
  }

  .mark:hover {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  .mark img {
    display: block;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    padding: 14px 32px 20px;
  }

  .legend {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--text-tertiary);
    font-size: 12px;
  }

  @media (max-width: 940px) {
    main {
      flex-direction: column;
    }

    .stage {
      height: 100%;
    }

    .scroll {
      align-content: start;
      overflow-y: auto;
      padding: 16px 16px 132px;
    }

    footer {
      display: none;
    }
  }

  @media (max-width: 640px) {
    nav {
      padding: 18px 14px 0;
    }

    .only-wide {
      display: none;
    }
  }
</style>
