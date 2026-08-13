<script lang="ts">
  import { fly } from "svelte/transition";
  import { Code } from "@lucide/svelte";
  import { t } from "../i18n/locale.svelte.js";
  import { keys } from "../i18n/keys.svelte.js";
  import About from "./About.svelte";
  import { pointer } from "./pointer.svelte.js";

  interface Props {
    oncontinue: () => void;
  }
  let { oncontinue }: Props = $props();

  let about = $state(false);

  let touch = $derived(pointer.coarse);

  let fixes = $derived([
    {
      title: touch ? "welcome.fix1.title.touch" : "welcome.fix1.title",
      body: touch ? "welcome.fix1.body.touch" : "welcome.fix1.body",
    },
    { title: "welcome.fix2.title", body: "welcome.fix2.body" },
    { title: "welcome.fix3.title", body: "welcome.fix3.body" },
  ] as const);

  $effect(() => pointer.watch());
</script>

<div class="welcome">
  <div class="panel" in:fly={{ y: 16, duration: 420 }}>
    <button class="mark" onclick={() => (about = true)} aria-label={t("about.open")}>
      <img src="/favicon.svg" alt="" width="76" height="76" />
    </button>

    <h1>
      {t("welcome.headingBefore")}<em>{t("welcome.headingEm")}</em>{touch
        ? t("welcome.headingAfter.touch")
        : t("welcome.headingAfter")}
    </h1>
    <p class="lede">{touch ? t("welcome.lede.touch") : t("welcome.lede")}</p>

    <ul>
      {#each fixes as fix (fix.title)}
        <li>
          <h2>{t(fix.title)}</h2>
          <p>{t(fix.body)}</p>
        </li>
      {/each}
    </ul>

    <button class="start" onclick={oncontinue}>
      {t("welcome.cta")}
      {#if !touch}<span class="key">{keys.enter}</span>{/if}
    </button>

    {#if touch}<p class="desktopHint">{t("welcome.desktopHint")}</p>{/if}

    <p class="privacy">{t("welcome.privacy")}</p>

    <footer>
      <a
        href="https://github.com/javierferrersb/dotworkout"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Code size={15} strokeWidth={2} />
        {t("welcome.source")}
      </a>
    </footer>
  </div>
</div>

{#if about}
  <About onclose={() => (about = false)} />
{/if}

<style>
  .welcome {
    height: 100%;
    display: grid;
    place-items: center;
    padding: 40px 32px;
    overflow-y: auto;
  }

  .panel {
    width: min(580px, 100%);
  }

  .mark {
    display: block;
    padding: 0;
    margin: 0 0 20px;
    border-radius: 12px;
    transition: transform 140ms var(--ease);
  }

  .mark:hover {
    transform: translateY(-2px);
  }

  .mark img {
    display: block;
  }

  h1 {
    margin: 0 0 18px;
    font-size: clamp(30px, 5vw, 48px);
    line-height: 1.04;
    font-weight: 700;
    letter-spacing: -1.5px;
  }

  h1 em {
    color: var(--accent);
    font-style: normal;
  }

  .lede {
    margin: 0 0 38px;
    color: var(--text-secondary);
    font-size: 17px;
    line-height: 1.55;
  }

  ul {
    list-style: none;
    margin: 0 0 36px;
    padding: 0;
    display: grid;
    gap: 22px;
  }

  li {
    padding-left: 18px;
    border-left: 2px solid var(--accent-edge);
  }

  li h2 {
    margin: 0 0 5px;
    font-size: 16px;
    font-weight: 600;
  }

  li p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.55;
  }

  .start {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 15px 26px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-size: 16px;
    font-weight: 600;
    transition: transform 140ms var(--ease);
  }

  .start:hover {
    transform: translateY(-1px);
  }

  .key {
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.22);
    font-size: 12px;
  }

  .desktopHint {
    margin: 16px 0 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  .privacy {
    margin: 20px 0 0;
    color: var(--text-tertiary);
    font-size: 13px;
  }

  footer {
    margin-top: 44px;
    padding-top: 20px;
    border-top: 1px solid var(--hairline);
    color: var(--text-tertiary);
    font-size: 13px;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 120ms var(--ease);
  }

  a:hover {
    color: var(--accent);
  }

  @media (max-width: 640px) {
    .welcome {
      padding: 32px 20px;
      place-items: start center;
    }

    .mark {
      width: 60px;
      height: 60px;
      margin-bottom: 16px;
    }

    .lede {
      margin-bottom: 28px;
      font-size: 16px;
    }

    .start {
      width: 100%;
      justify-content: center;
    }
  }
</style>
