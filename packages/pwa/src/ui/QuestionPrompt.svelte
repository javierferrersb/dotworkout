<script lang="ts">
  import { fly } from "svelte/transition";
  import { Check, CornerDownLeft } from "@lucide/svelte";
  import type { Question } from "../domain/interview.js";
  import { choiceKey, choiceText, questionNote, questionText } from "../i18n/format.js";
  import { t } from "../i18n/locale.svelte.js";
  import { flashConfirm } from "./confirmFlash.js";
  import { keys } from "../i18n/keys.svelte.js";

  interface Props {
    question: Question;
    problem: string | undefined;
    chosen: string | undefined;
    activityId: string;
    onanswer: (raw: string) => void;
    onskip: () => void;
  }
  let { question, problem, chosen, activityId, onanswer, onskip }: Props = $props();

  let entry = $state("");
  let field = $state<HTMLInputElement | undefined>(undefined);
  let buttons = $state<Record<string, HTMLButtonElement>>({});

  $effect(() => {
    question.id;
    entry = question.form.type === "choice" ? "" : (chosen ?? "");
    queueMicrotask(() => {
      field?.focus();
      field?.select();
    });
  });

  export async function pressKey(value: string): Promise<void> {
    await flashConfirm(buttons[value]);
    onanswer(value);
  }

  function submit(event: Event) {
    event.preventDefault();
    const value = entry.trim();
    if (value === "") {
      if (question.optional) onskip();
      return;
    }
    onanswer(value);
  }

  function useSuggestion(word: string) {
    entry = word;
    field?.focus();
  }
</script>

<section class="prompt" in:fly={{ y: 10, duration: 260 }}>
  <header>
    <h2>{questionText(question)}</h2>
    {#if question.optional}<span class="tag">{t("prompt.optional")}</span>{/if}
  </header>
  {#if questionNote(question)}<p class="note">{questionNote(question)}</p>{/if}

  {#if question.form.type === "choice"}
    {#if question.optional}
      <p class="hint">{t("prompt.skipChoiceHint", { enter: keys.enter, tab: keys.tab })}</p>
    {/if}
    <div class="choices">
      {#each question.form.choices as choice (choice.value)}
        <button
          bind:this={buttons[choice.value]}
          class="choice"
          class:chosen={chosen === choice.value}
          onclick={() => pressKey(choice.value)}
        >
          <kbd>{choiceKey(choice, activityId)}</kbd>
          <span>{choiceText(choice, activityId)}</span>
          {#if choice.caution}<span class="flag">{t("prompt.notVerified")}</span>{/if}
          {#if chosen === choice.value}<Check class="current" size={17} strokeWidth={3} />{/if}
        </button>
      {/each}
    </div>
  {:else}
    <form onsubmit={submit}>
      <input
        bind:this={field}
        bind:value={entry}
        placeholder={question.form.type === "distance"
          ? `0 ${question.form.unit}`
          : question.form.type === "text"
            ? t("prompt.namePlaceholder")
            : question.form.placeholder}
        inputmode={question.form.type === "count" ? "numeric" : "text"}
        aria-label={questionText(question)}
        spellcheck="false"
      />
      {#if question.form.type === "distance"}<span class="unit">{question.form.unit}</span>{/if}
      <button type="submit" class="go" aria-label={t("prompt.confirm")}>
        <CornerDownLeft size={15} strokeWidth={2.4} />
        {keys.enter}
      </button>
    </form>

    {#if question.form.type === "text"}
      <div class="suggestions">
        {#each question.form.suggestions as word (word)}
          <button class="suggestion" onclick={() => useSuggestion(word)}>{word}</button>
        {/each}
      </div>
    {/if}

    {#if question.optional}
      <p class="hint">{t("prompt.skipHint", { tab: keys.tab })}</p>
    {/if}
  {/if}

  {#if problem}<p class="problem">{problem}</p>{/if}
</section>

<style>
  .prompt {
    background: var(--bg-surface);
    border: 1px solid var(--accent-edge);
    border-radius: var(--radius-card);
    padding: 22px 24px 24px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    box-shadow: var(--shadow);
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .tag {
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .note {
    margin: -8px 0 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.45;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .choice {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 11px 18px 11px 11px;
    border-radius: var(--radius-control);
    background: var(--bg-raised);
    font-size: 15px;
    transition:
      transform 120ms var(--ease),
      background 120ms var(--ease);
  }

  .choice:hover {
    background: var(--accent-soft);
    transform: translateY(-1px);
  }

  .choice.chosen {
    background: var(--accent);
    color: var(--on-accent);
  }

  .choice.chosen kbd {
    background: rgba(255, 255, 255, 0.22);
    color: inherit;
  }

  .choice :global(.current) {
    margin-left: 2px;
  }

  kbd {
    display: grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border-radius: 7px;
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 600;
  }

  .flag {
    color: var(--text-tertiary);
    font-size: 11px;
  }

  form {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg-raised);
    border-radius: var(--radius-control);
    padding: 4px 6px 4px 18px;
  }

  input {
    flex: 1;
    font-family: var(--mono);
    font-size: 22px;
    padding: 12px 0;
    min-width: 0;
  }

  input::placeholder {
    color: var(--text-tertiary);
  }

  .unit {
    color: var(--text-tertiary);
    font-size: 15px;
  }

  .go {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 16px;
    border-radius: 10px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .suggestion {
    padding: 7px 14px;
    border-radius: var(--radius-pill);
    background: var(--bg-raised);
    color: var(--text-secondary);
    font-size: 13px;
    transition: all 120ms var(--ease);
  }

  .suggestion:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .hint,
  .problem {
    margin: 0;
    font-size: 13px;
  }

  .hint {
    color: var(--text-tertiary);
  }

  .problem {
    color: var(--danger);
  }
  @media (max-width: 640px) {
    .prompt {
      padding: 18px 16px 20px;
    }

    h2 {
      font-size: 20px;
    }

    input {
      font-size: 18px;
    }

    form {
      padding: 4px 5px 4px 14px;
      gap: 8px;
    }

    .go {
      padding: 10px 12px;
      font-size: 12px;
    }

    .choice {
      font-size: 14px;
      padding: 10px 14px 10px 10px;
    }
  }
</style>