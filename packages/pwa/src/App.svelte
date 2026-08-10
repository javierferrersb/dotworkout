<script lang="ts">
  import { fade } from "svelte/transition";
  import { AppFlow } from "./application/appFlow.svelte.js";
  import { CompositionSession } from "./application/compositionSession.svelte.js";
  import { clearInboundWorkout, readInboundWorkout } from "./application/share.js";
  import { saveBytes } from "./application/workoutFile.js";
  import type { Activity } from "./domain/activity.js";
  import ActivityPicker from "./ui/ActivityPicker.svelte";
  import Composer from "./ui/Composer.svelte";
  import Welcome from "./ui/Welcome.svelte";

  const flow = new AppFlow();
  const session = new CompositionSession();

  const inbound = readInboundWorkout();

  $effect(() => {
    flow.applyTheme();
  });

  function keepInbound() {
    if (inbound === undefined) return;
    saveBytes(inbound.bytes, inbound.title);
    clearInboundWorkout();
    location.reload();
  }

  function onKeydown(event: KeyboardEvent) {
    if (flow.stage === "welcome" && event.key === "Enter" && inbound === undefined) {
      event.preventDefault();
      flow.go("choose");
    }
  }

  function pick(activity: Activity) {
    session.chooseActivity(activity);
    session.title = `${activity.title} workout`;
    flow.go("compose");
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="stack">
  {#if inbound !== undefined}
    <div class="screen">
      <div class="handoff">
        <div class="sheet">
          <h1>{inbound.title}</h1>
          <p>A workout was shared with you. Save it, then open it in the Workouts app.</p>
          <button onclick={keepInbound}>Save the file</button>
          <button
            class="ghost"
            onclick={() => {
              clearInboundWorkout();
              location.reload();
            }}
          >
            Start my own instead
          </button>
        </div>
      </div>
    </div>
  {:else if flow.stage === "welcome"}
    <div class="screen" out:fade={{ duration: 120 }}>
      <Welcome oncontinue={() => flow.go("choose")} />
    </div>
  {:else if flow.stage === "choose"}
    <div class="screen" out:fade={{ duration: 120 }}>
      <ActivityPicker onpick={pick} onback={() => flow.go("welcome")} />
    </div>
  {:else}
    <div class="screen">
      <Composer
        {session}
        theme={flow.theme}
        onback={() => flow.go("choose")}
        ontheme={() => flow.toggleTheme()}
      />
    </div>
  {/if}
</div>

<style>
  .stack {
    position: relative;
    height: 100%;
    overflow: hidden;
  }

  .screen {
    position: absolute;
    inset: 0;
    background: var(--bg-canvas);
  }

  .handoff {
    height: 100%;
    display: grid;
    place-items: center;
    padding: 32px;
  }

  .sheet {
    width: min(420px, 100%);
    display: grid;
    gap: 14px;
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.8px;
  }

  .sheet p {
    margin: 0 0 8px;
    color: var(--text-secondary);
    font-size: 15px;
    line-height: 1.5;
  }

  button {
    padding: 14px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-size: 15px;
    font-weight: 600;
  }

  .ghost {
    background: var(--bg-raised);
    color: var(--text-primary);
    font-weight: 500;
  }
</style>
