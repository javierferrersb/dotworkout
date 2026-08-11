<script lang="ts">
  import { untrack } from "svelte";
  import { fly } from "svelte/transition";
  import { CornerDownLeft } from "@lucide/svelte";
  import type { Activity } from "../domain/activity.js";
  import BackButton from "./BackButton.svelte";

  interface Props {
    activity: Activity;
    initial: string;
    onconfirm: (title: string) => void;
    onback: () => void;
  }
  let { activity, initial, onconfirm, onback }: Props = $props();

  let title = $state(untrack(() => initial));
  let field = $state<HTMLInputElement | undefined>(undefined);

  $effect(() => {
    field?.focus();
    field?.select();
  });

  function submit(event: Event) {
    event.preventDefault();
    onconfirm(title.trim() === "" ? `${activity.title} workout` : title.trim());
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onback();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<BackButton label={activity.title} onclick={onback} />

<div class="naming">
  <div class="panel" in:fly={{ y: 14, duration: 360 }}>
    <p class="eyebrow">{activity.title}</p>
    <h1>What are you calling it?</h1>
    <p class="lede">This is the name you’ll see in the Workouts app.</p>

    <form onsubmit={submit}>
      <input
        bind:this={field}
        bind:value={title}
        placeholder={`${activity.title} workout`}
        aria-label="Workout name"
        spellcheck="false"
        maxlength="60"
      />
      <button type="submit">
        Continue
        <CornerDownLeft size={15} strokeWidth={2.4} />
      </button>
    </form>

    <p class="hint">You can change it later from the summary panel.</p>
  </div>
</div>

<style>
  .naming {
    height: 100%;
    display: grid;
    place-items: center;
    padding: 32px;
    overflow-y: auto;
  }

  .panel {
    width: min(560px, 100%);
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--accent);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0 0 10px;
    font-size: clamp(28px, 4vw, 38px);
    font-weight: 700;
    letter-spacing: -1px;
  }

  .lede {
    margin: 0 0 26px;
    color: var(--text-secondary);
    font-size: 16px;
  }

  form {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 20px;
    border-radius: var(--radius-control);
    background: var(--bg-surface);
    box-shadow: var(--shadow);
  }

  input {
    flex: 1;
    min-width: 0;
    font-size: 20px;
    padding: 12px 0;
  }

  input::placeholder {
    color: var(--text-tertiary);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 13px 20px;
    border-radius: 10px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
  }

  .hint {
    margin: 16px 0 0;
    color: var(--text-tertiary);
    font-size: 13px;
  }
</style>
