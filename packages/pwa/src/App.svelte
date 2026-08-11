<script lang="ts">
  import { fade } from "svelte/transition";
  import { AppFlow } from "./application/appFlow.svelte.js";
  import { CompositionSession } from "./application/compositionSession.svelte.js";
  import { clearSession, loadSession, saveSession } from "./application/sessionStore.js";
  import { clearInboundWorkout, readInboundWorkout } from "./application/share.js";
  import { saveBytes } from "./application/workoutFile.js";
  import { ACTIVITY_CATALOGUE, type Activity } from "./domain/activity.js";
  import { activityName } from "./i18n/format.js";
  import { locale, t } from "./i18n/locale.svelte.js";
  import ActivityPicker from "./ui/ActivityPicker.svelte";
  import Composer from "./ui/Composer.svelte";
  import NameWorkout from "./ui/NameWorkout.svelte";
  import Welcome from "./ui/Welcome.svelte";

  const flow = new AppFlow();
  const session = new CompositionSession();

  const arrivedWithWorkout = readInboundWorkout();

  let inbound = $state(arrivedWithWorkout);
  let restored = $state(false);
  let handoff = $state<"idle" | "saved">("idle");

  if (arrivedWithWorkout === undefined) {
    const saved = loadSession();
    const activity =
      saved === undefined
        ? undefined
        : ACTIVITY_CATALOGUE.find((candidate) => candidate.id === saved.activityId);
    if (saved !== undefined && activity !== undefined) {
      session.restore(activity, saved.title, saved.blocks, saved.cursor);
      flow.go(saved.stage);
      restored = saved.stage === "compose" && saved.blocks.length > 0;
    }
  }

  $effect(() => {
    flow.applyTheme();
  });

  $effect(() => {
    locale.apply();
  });

  $effect(() => flow.watchSystem());

  const resumedSnapshot = JSON.stringify(session.snapshot);

  $effect(() => {
    if (inbound !== undefined) return;
    saveSession({ ...session.snapshot, stage: flow.stage });
  });

  $effect(() => {
    if (!restored) return;
    if (JSON.stringify(session.snapshot) !== resumedSnapshot) restored = false;
  });

  $effect(() => {
    if (!restored) return;
    const timer = setTimeout(() => (restored = false), 8000);
    return () => clearTimeout(timer);
  });

  function keepInbound() {
    if (inbound === undefined) return;
    saveBytes(inbound.bytes, inbound.title);
    handoff = "saved";
  }

  function leaveInbound() {
    clearInboundWorkout();
    inbound = undefined;
    handoff = "idle";
  }

  function onHashChange() {
    const arriving = readInboundWorkout();
    if (arriving === undefined) return;
    inbound = arriving;
    handoff = "idle";
  }

  function startOver() {
    clearSession();
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
    session.title = t("naming.defaultTitle", { activity: activityName(activity.id) });
    flow.go("name");
  }

  function named(title: string) {
    session.title = title;
    flow.go("compose");
  }
</script>

<svelte:window onkeydown={onKeydown} onhashchange={onHashChange} />

<div class="stack">
  {#if inbound !== undefined}
    <div class="screen">
      <div class="handoff">
        <div class="sheet">
          <h1>{inbound.title}</h1>
          {#if handoff === "idle"}
            <p>{t("handoff.body")}</p>
            <button onclick={keepInbound}>{t("handoff.save")}</button>
          {:else}
            <p class="done">{t("handoff.saved")}</p>
            <button onclick={keepInbound}>{t("handoff.again")}</button>
          {/if}
          <button class="ghost" onclick={leaveInbound}>{t("handoff.mine")}</button>
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
  {:else if flow.stage === "name"}
    <div class="screen" out:fade={{ duration: 120 }}>
      <NameWorkout
        activity={session.activity}
        initial={session.title}
        onconfirm={named}
        onback={() => flow.go("choose")}
      />
    </div>
  {:else}
    <div class="screen">
      <Composer
        {session}
        themeChoice={flow.themeChoice}
        onback={() => flow.go("choose")}
        ontheme={(choice) => flow.setTheme(choice)}
        onreset={startOver}
      />
    </div>
  {/if}

  {#if restored}
    <div class="resumed" transition:fade={{ duration: 180 }}>
      <span>{t("resume.text")}</span>
      <button onclick={() => (restored = false)}>{t("resume.ok")}</button>
      <button class="link" onclick={startOver}>{t("resume.fresh")}</button>
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

  .done {
    color: var(--lime);
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

  .resumed {
    position: absolute;
    left: 50%;
    bottom: 22px;
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px 10px 18px;
    border-radius: var(--radius-pill);
    background: var(--bg-surface);
    box-shadow: var(--shadow);
    font-size: 13px;
    white-space: nowrap;
  }

  .resumed button {
    padding: 7px 14px;
    font-size: 13px;
  }

  .resumed .link {
    background: none;
    color: var(--text-secondary);
    font-weight: 500;
    padding: 7px 6px;
  }

  .resumed .link:hover {
    color: var(--accent);
  }
</style>
