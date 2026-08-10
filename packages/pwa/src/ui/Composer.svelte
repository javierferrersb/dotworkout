<script lang="ts">
  import { fly } from "svelte/transition";
  import type { CompositionSession } from "../application/compositionSession.svelte.js";
  import BackButton from "./BackButton.svelte";
  import BlockCard from "./BlockCard.svelte";
  import Kbd from "./Kbd.svelte";
  import SummaryRail from "./SummaryRail.svelte";
  import { BLOCK_DOWN_HINT, BLOCK_UP_HINT, KEY } from "./platform.js";

  interface Props {
    session: CompositionSession;
    onback: () => void;
    ontheme: () => void;
    theme: "dark" | "light";
  }
  let { session, onback, ontheme, theme }: Props = $props();

  let card = $state<BlockCard | undefined>(undefined);
  let rail = $state<SummaryRail | undefined>(undefined);

  const LEGEND = [
    { key: `${KEY.up} ${KEY.down}`, what: "question" },
    { key: `${BLOCK_UP_HINT} / ${BLOCK_DOWN_HINT}`, what: "block" },
    { key: KEY.enter, what: "confirm" },
    { key: KEY.tab, what: "skip" },
    { key: KEY.escape, what: "deselect" },
  ];

  function typing(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  }

  function onKeydown(event: KeyboardEvent) {
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
    if (event.key === "Enter" && !event.shiftKey && !typing(event.target)) {
      const optionalChoice = session.current;
      if (optionalChoice?.optional === true && optionalChoice.form.type === "choice") {
        event.preventDefault();
        session.skip(optionalChoice.id);
        return;
      }
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

    const question = session.current;
    if (question === undefined || question.form.type !== "choice") return;
    if (meta || event.altKey) return;
    const choice = question.form.choices.find(
      (candidate) => candidate.key.toLowerCase() === event.key.toLowerCase(),
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
    <BackButton label={session.activity.title} onclick={onback} />
    <nav>
      <span class="grow"></span>
      <button class="theme" onclick={ontheme} aria-label="Toggle colour scheme">
        {theme === "dark" ? "Light" : "Dark"}
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
      {#each LEGEND as entry (entry.key)}
        <span class="legend"><Kbd label={entry.key} />{entry.what}</span>
      {/each}
    </footer>
  </section>

  <SummaryRail bind:this={rail} {session} />
</main>

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
    padding: 20px 32px 0;
    min-height: 42px;
  }

  .grow {
    flex: 1;
  }

  .theme {
    color: var(--text-secondary);
    font-size: 14px;
    padding: 8px 14px;
    border-radius: var(--radius-pill);
    transition: all 140ms var(--ease);
  }

  .theme:hover {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    align-content: center;
    padding: 24px 32px;
  }

  .column {
    width: min(680px, 100%);
    margin: 0 auto;
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
  }
</style>
