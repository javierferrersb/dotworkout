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
          {#if chosen === choice.value}<Check class="current" size={15} strokeWidth={2} />{/if}
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
        <CornerDownLeft size={14} strokeWidth={2} />
        {keys.enter}
      </button>
    </form>

    {#if question.form.type === "text"}
      <div class="suggestions">
        {#each question.form.suggestions as key (key)}
          <button class="suggestion" onclick={() => useSuggestion(t(key))}>{t(key)}</button>
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
    border: 1px solid var(--hairline);
    border-radius: var(--radius-card);
    padding: 20px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.015em;
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
    gap: 8px;
  }

  .choice {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px 8px 8px;
    border: 1px solid var(--hairline-strong);
    border-radius: var(--radius-control);
    background: var(--bg-surface);
    font-size: 14.5px;
    transition:
      background 100ms var(--ease),
      border-color 100ms var(--ease);
  }

  .choice:hover {
    background: var(--bg-raised);
  }

  .choice.chosen {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--on-ink);
  }

  .choice.chosen kbd {
    border-color: transparent;
    background: color-mix(in srgb, currentColor 18%, transparent);
    color: inherit;
  }

  .choice :global(.current) {
    margin-left: 2px;
  }

  kbd {
    display: grid;
    place-items: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border: 1px solid var(--hairline-strong);
    border-radius: 5px;
    background: var(--bg-raised);
    color: var(--text-secondary);
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 500;
  }

  .flag {
    color: var(--text-tertiary);
    font-size: 11px;
  }

  form {
    display: flex;
    align-items: center;
    gap: 10px;
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
    font-size: 20px;
    font-weight: 500;
    padding: 10px 0;
    min-width: 0;
  }

  input::placeholder {
    color: var(--text-tertiary);
    font-weight: 400;
  }

  .unit {
    color: var(--text-tertiary);
    font-size: 15px;
  }

  .go {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 12px;
    border-radius: 7px;
    background: var(--ink);
    color: var(--on-ink);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    transition: background 120ms var(--ease);
  }

  .go:hover {
    background: var(--ink-hover);
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .suggestion {
    padding: 5px 10px;
    border: 1px solid var(--hairline-strong);
    border-radius: var(--radius-control);
    color: var(--text-secondary);
    font-size: 13px;
    transition:
      background 100ms var(--ease),
      color 100ms var(--ease);
  }

  .suggestion:hover {
    background: var(--bg-raised);
    color: var(--text-primary);
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
      padding: 16px;
    }

    h2 {
      font-size: 18px;
    }

    input {
      font-size: 18px;
    }

    form {
      padding: 4px 4px 4px 12px;
      gap: 8px;
    }

    .go {
      padding: 9px 11px;
      font-size: 12px;
    }

    .choice {
      font-size: 14px;
      padding: 7px 12px 7px 7px;
    }
  }
</style>
