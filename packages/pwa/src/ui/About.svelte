<script lang="ts">
  import { fly } from "svelte/transition";
  import { ExternalLink } from "@lucide/svelte";
  import { t } from "../i18n/locale.svelte.js";
  import { modals } from "./modal.svelte.js";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  const LINKS = [
    { key: "about.open.source", href: "https://github.com/javierferrersb/dotworkout" },
    { key: "about.open.packages", href: "https://www.npmjs.com/org/dotworkout" },
    {
      key: "about.open.mcp",
      href: "https://github.com/javierferrersb/dotworkout/tree/main/packages/mcp",
    },
  ] as const;

  const SECTIONS = [
    { title: "about.format.title", body: "about.format.body" },
    { title: "about.privacy.title", body: "about.privacy.body" },
  ] as const;

  let sheet = $state<HTMLElement | undefined>(undefined);

  $effect(() => (sheet === undefined ? undefined : modals.enter(sheet)));
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && onclose()} />

<div class="scrim">
  <button class="dismiss" onclick={onclose} aria-label={t("about.close")}></button>

  <div
    class="sheet"
    bind:this={sheet}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-label={t("about.heading")}
    transition:fly={{ y: 12, duration: 220 }}
  >
    <header>
      <img src="/favicon.svg" alt="" width="32" height="32" />
      <h2>{t("about.heading")}</h2>
    </header>

    <p class="lede">{t("about.what")}</p>

    {#each SECTIONS as section (section.title)}
      <section>
        <h3>{t(section.title)}</h3>
        <p>{t(section.body)}</p>
      </section>
    {/each}

    <ul>
      {#each LINKS as link (link.href)}
        <li>
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            {t(link.key)}
            <ExternalLink size={14} strokeWidth={2} />
          </a>
        </li>
      {/each}
    </ul>

    <p class="fine">{t("about.notApple")}</p>

    <button class="ok" onclick={onclose}>{t("about.close")}</button>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
    padding: 24px;
    z-index: 25;
    overflow-y: auto;
  }

  .dismiss {
    position: absolute;
    inset: 0;
    cursor: default;
  }

  .sheet:focus {
    outline: none;
  }

  .sheet {
    position: relative;
    width: min(440px, 100%);
    background: var(--bg-surface);
    border: 1px solid var(--hairline);
    border-radius: 14px;
    padding: 24px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    box-shadow: var(--shadow-pop);
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  header img {
    border-radius: 7px;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.015em;
  }

  .lede {
    margin: 0;
    font-size: 15px;
    line-height: 1.55;
    color: var(--text-secondary);
  }

  section {
    display: grid;
    gap: 2px;
  }

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  section p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }

  a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 12px;
    border: 1px solid var(--hairline);
    border-radius: var(--radius-control);
    color: var(--text-primary);
    text-decoration: none;
    font-size: 14px;
    transition: background 100ms var(--ease);
  }

  a:hover {
    background: var(--bg-raised);
  }

  a :global(svg) {
    color: var(--text-tertiary);
  }

  .fine {
    margin: 0;
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .ok {
    padding: 11px;
    border-radius: var(--radius-control);
    background: var(--ink);
    color: var(--on-ink);
    font-size: 14px;
    font-weight: 600;
    transition: background 120ms var(--ease);
  }

  .ok:hover {
    background: var(--ink-hover);
  }
</style>
