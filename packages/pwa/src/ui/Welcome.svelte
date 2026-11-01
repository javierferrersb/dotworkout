<script lang="ts">
  import { fly } from "svelte/transition";
  import { Code, HeartPulse, Keyboard, Languages, Rows3, Watch } from "@lucide/svelte";
  import { locale, t } from "../i18n/locale.svelte.js";
  import { keys } from "../i18n/keys.svelte.js";
  import { LOCALES, type LocaleCode } from "../i18n/messages.js";
  import About from "./About.svelte";
  import Kbd from "./Kbd.svelte";
  import Menu from "./Menu.svelte";
  import WelcomePreview from "./WelcomePreview.svelte";
  import { pointer } from "./pointer.svelte.js";

  interface Props {
    oncontinue: () => void;
  }
  let { oncontinue }: Props = $props();

  let about = $state(false);

  let localeOptions = $derived(LOCALES.map((entry) => ({ value: entry.code, label: entry.label })));

  let touch = $derived(pointer.coarse);

  let fixes = $derived(
    touch
      ? ([
          { title: "welcome.fix1.title.touch", icon: Rows3 },
          { title: "welcome.fix2.title", icon: HeartPulse },
          { title: "welcome.fix3.title", icon: Watch },
        ] as const)
      : ([
          { title: "welcome.fix0.title", icon: Keyboard },
          { title: "welcome.fix2.title", icon: HeartPulse },
          { title: "welcome.fix3.title", icon: Watch },
        ] as const),
  );

  $effect(() => pointer.watch());
</script>

<div class="welcome">
  <div class="page">
    <header>
      <button class="brand" onclick={() => (about = true)} aria-label={t("about.open")}>
        <img src="/favicon.svg" alt="" width="24" height="24" />
        <span>Dot Workout</span>
      </button>

      <div class="tools">
        <a
          class="source"
          href="https://github.com/javierferrersb/dotworkout"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("welcome.source")}
        >
          <Code size={15} strokeWidth={2} />
          <span class="sourceText">{t("welcome.source")}</span>
        </a>

        <Menu
          label={t("language.label")}
          options={localeOptions}
          selected={locale.code}
          onselect={(value) => locale.set(value as LocaleCode)}
        >
          {#snippet trigger()}
            <Languages size={15} strokeWidth={2} />
            <span>{locale.code.toUpperCase()}</span>
          {/snippet}
        </Menu>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="copy" in:fly={{ y: 12, duration: 380 }}>
          <h1>
            {t("welcome.headingBefore")}<em>{t("welcome.headingEm")}</em>{t("welcome.headingAfter")}
          </h1>
          <p class="lede">{touch ? t("welcome.lede.touch") : t("welcome.lede")}</p>

          <button class="start" onclick={oncontinue}>
            {t("welcome.cta")}
            {#if !touch}<Kbd label={keys.enter} tone="onAccent" />{/if}
          </button>

          {#if touch}<p class="desktopHint">{t("welcome.desktopHint")}</p>{/if}
        </div>

        <div class="shot" in:fly={{ y: 12, duration: 460, delay: 120 }}>
          <WelcomePreview />
        </div>
      </section>

      <ul>
        {#each fixes as fix (fix.title)}
          <li>
            <fix.icon size={16} strokeWidth={2} aria-hidden="true" />
            <h2>{t(fix.title)}</h2>
          </li>
        {/each}
      </ul>

      <p class="privacy">{t("welcome.privacy")}</p>
    </main>
  </div>
</div>

{#if about}
  <About onclose={() => (about = false)} />
{/if}

<style>
  .welcome {
    --gutter: 20px;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .page {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 var(--gutter);
  }

  header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 12px;
    margin-right: -8px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-left: -6px;
    padding: 6px;
    border-radius: var(--radius-control);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.005em;
  }

  .brand img {
    display: block;
    border-radius: 5px;
  }

  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .source {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    border-radius: var(--radius-control);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition:
      background 120ms var(--ease),
      color 120ms var(--ease);
  }

  .source:hover {
    background: var(--bg-raised);
    color: var(--text-primary);
  }

  .sourceText {
    display: none;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 36px 0 40px;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .copy {
    max-width: 480px;
  }

  .shot {
    display: none;
  }

  h1 {
    margin: 0 0 16px;
    font-size: clamp(32px, 9vw, 46px);
    line-height: 1.04;
    font-weight: 600;
    letter-spacing: -0.035em;
  }

  h1 em {
    font-style: normal;
  }

  .lede {
    margin: 0 0 28px;
    color: var(--text-secondary);
    font-size: 16px;
    line-height: 1.55;
  }

  .start {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px 16px 12px 20px;
    border-radius: 10px;
    background: var(--ink);
    color: var(--on-ink);
    font-size: 15px;
    font-weight: 600;
    transition: background 120ms var(--ease);
  }

  .start:hover {
    background: var(--ink-hover);
  }

  .desktopHint {
    margin: 14px 0 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  ul {
    list-style: none;
    margin: 40px 0 0;
    padding: 0;
    border-top: 1px solid var(--hairline);
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 13px 0;
    border-bottom: 1px solid var(--hairline);
    color: var(--text-tertiary);
  }

  li :global(svg) {
    flex: none;
    margin-top: 2px;
  }

  li h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 14.5px;
    font-weight: 500;
    line-height: 1.4;
  }

  .privacy {
    margin: 16px 0 0;
    color: var(--text-tertiary);
    font-size: 13px;
    line-height: 1.5;
  }

  @media (min-width: 700px) {
    .welcome {
      --gutter: 40px;
    }

    .sourceText {
      display: inline;
    }

    .shot {
      display: block;
      width: 100%;
      max-width: 664px;
      margin-top: 44px;
    }
  }

  @media (min-width: 1180px) {
    .welcome {
      --gutter: 48px;
    }

    .hero {
      grid-template-columns: minmax(360px, 460px) minmax(0, 1fr);
      gap: clamp(32px, 5vw, 80px);
      align-items: center;
    }

    .shot {
      justify-self: end;
      margin-top: 0;
    }

    ul {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 0 32px;
      margin-top: 48px;
      padding-top: 18px;
    }

    li {
      padding: 0;
      border-bottom: none;
    }

    .privacy {
      margin-top: 28px;
    }
  }

  @media (max-width: 640px) {
    .start {
      width: 100%;
    }
  }
</style>
