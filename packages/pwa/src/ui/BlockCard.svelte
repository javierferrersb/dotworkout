<script lang="ts">
  import { fly } from "svelte/transition";
  import { Check } from "@lucide/svelte";
  import type { CompositionSession } from "../application/compositionSession.svelte.js";
  import { rawAnswer } from "../domain/interview.js";
  import { answerLabel, blockHeading, questionText } from "../i18n/format.js";
  import { t } from "../i18n/locale.svelte.js";
  import { KEY } from "./platform.js";
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
          ? t("block.newBlock", { index: session.blocks.length + 1, total: session.blocks.length + 1 })
          : t("block.editing", { index: session.cursor + 1, total: session.blocks.length })}
      </p>
    </div>
    {#if session.complete}
      <button class="commit" onclick={() => session.commitBlock()}>
        {session.composingNew ? t("block.add") : t("block.done")}
        <kbd>{KEY.enter}</kbd>
      </button>
    {/if}
  </header>

  <div class="answers">
    {#each session.answered as question (question.id)}
      <button class="answered" onclick={() => session.focus(question.id)} transition:fly={{ y: -6, duration: 200 }}>
        <Check class="tick" size={15} strokeWidth={3} />
        <span class="label">{questionText(question)}</span>
        <span class="value">{answerLabel(session.draft, question.id, session.activity.id)}</span>
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
        activityId={session.activity.id}
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
</article>

<style>
  .block {
    display: grid;
    gap: 14px;
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
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.9px;
  }

  .who p {
    margin: 4px 0 0;
    color: var(--text-tertiary);
    font-size: 13px;
  }

  .commit {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 11px 18px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    transition: transform 140ms var(--ease);
  }

  .commit:hover {
    transform: translateY(-1px);
  }

  .commit kbd {
    padding: 2px 7px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.22);
    font-family: var(--sans);
    font-size: 11px;
  }

  .answers {
    display: grid;
    gap: 2px;
  }

  .answered {
    display: flex;
    align-items: baseline;
    gap: 14px;
    width: 100%;
    padding: 8px 12px;
    border-radius: 10px;
    text-align: left;
    transition: background 120ms var(--ease);
  }

  .answered:hover {
    background: var(--bg-surface);
  }

  .answered :global(.tick) {
    color: var(--lime);
    flex: none;
  }

  .label {
    color: var(--text-tertiary);
    font-size: 14px;
    width: 140px;
    flex: none;
  }

  .value {
    font-family: var(--mono);
    font-size: 15px;
    color: var(--text-primary);
  }

  .upcoming {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 2px 12px;
  }

  .pending {
    color: var(--text-tertiary);
    font-size: 12px;
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: var(--bg-surface);
  }
</style>
