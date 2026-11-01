<script lang="ts">
  import { fly } from "svelte/transition";
  import type { CompositionSession } from "../application/compositionSession.svelte.js";
  import { rawAnswer } from "../domain/interview.js";
  import { answerLabel, blockHeading, questionText } from "../i18n/format.js";
  import { t } from "../i18n/locale.svelte.js";
  import { keys } from "../i18n/keys.svelte.js";
  import Kbd from "./Kbd.svelte";
  import QuestionPrompt from "./QuestionPrompt.svelte";

  interface Props {
    session: CompositionSession;
  }
  let { session }: Props = $props();

  let prompt = $state<QuestionPrompt | undefined>(undefined);

  export function pressKey(value: string): void {
    void prompt?.pressKey(value);
  }
</script>

<article class="block">
  <header>
    <div class="who">
      <h1>{blockHeading(session.draft, session.cursor)}</h1>
      <p>
        {session.composingNew
          ? t("block.newBlock", {
              index: session.blocks.length + 1,
              total: session.blocks.length + 1,
            })
          : t("block.editing", { index: session.cursor + 1, total: session.blocks.length })}
      </p>
    </div>
  </header>

  <div class="answers">
    {#each session.answered as question (question.id)}
      <button
        class="answered"
        onclick={() => session.focus(question.id)}
        transition:fly={{ y: -6, duration: 200 }}
      >
        <span class="label">{questionText(question)}</span>
        <span class="value">{answerLabel(session.draft, question.id, session.activity.sport)}</span>
      </button>
    {/each}
  </div>

  {#if session.current}
    {#key session.current.id}
      <QuestionPrompt
        bind:this={prompt}
        question={session.current}
        problem={session.problem}
        chosen={rawAnswer(session.draft, session.current.id)}
        activityId={session.activity.sport}
        onanswer={(raw) => session.answer(session.current!.id, raw)}
        onskip={() => session.skip(session.current!.id)}
      />
    {/key}
  {/if}

  {#if session.upcoming.length > 0}
    <div class="upcoming">
      {#each session.upcoming as question (question.id)}
        <span class="pending">{questionText(question)}</span>
      {/each}
    </div>
  {/if}

  {#if session.complete}
    <div class="finish" transition:fly={{ y: -6, duration: 200 }}>
      <button class="commit" onclick={() => session.commitBlock()}>
        {session.composingNew ? t("block.add") : t("block.done")}
        <Kbd label={keys.enter} tone="onAccent" />
      </button>
    </div>
  {/if}
</article>

<style>
  .block {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  header {
    display: flex;
    align-items: flex-end;
    gap: 16px;
  }

  .who {
    flex: 1;
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }

  .who p {
    margin: 2px 0 0;
    color: var(--text-tertiary);
    font-size: 13px;
  }

  .finish {
    display: flex;
  }

  .commit {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px 9px 16px;
    border-radius: var(--radius-control);
    background: var(--ink);
    color: var(--on-ink);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    transition: background 120ms var(--ease);
  }

  .commit:hover {
    background: var(--ink-hover);
  }

  .answers {
    display: grid;
    gap: 1px;
    margin: -4px -8px;
  }

  .answered {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr);
    gap: 12px;
    width: 100%;
    padding: 7px 8px;
    border-radius: var(--radius-sm);
    text-align: left;
    font-size: 14px;
    transition: background 100ms var(--ease);
  }

  .answered:hover {
    background: var(--bg-raised);
  }

  .label {
    color: var(--text-tertiary);
  }

  .value {
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  .upcoming {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pending {
    padding: 2px 8px;
    border: 1px solid var(--hairline);
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    font-size: 12px;
  }

  @media (max-width: 640px) {
    h1 {
      font-size: 20px;
    }

    .answered {
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 8px;
      font-size: 13.5px;
    }
  }
</style>
