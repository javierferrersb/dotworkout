<script lang="ts">
  import { fly } from "svelte/transition";
  import {
    Activity as Pulse,
    Bike,
    Dumbbell,
    Flame,
    Flower2,
    Footprints,
    Infinity as Loop,
    Mountain,
    Search,
    SportShoe,
    Target,
    TrendingUp,
    Waves,
    WavesLadder,
    Weight,
  } from "@lucide/svelte";
  import { ACTIVITY_CATALOGUE, type Activity } from "../domain/activity.js";
  import { activityName } from "../i18n/format.js";
  import { keys } from "../i18n/keys.svelte.js";
  import { t } from "../i18n/locale.svelte.js";
  import BackButton from "./BackButton.svelte";
  import Kbd from "./Kbd.svelte";
  import { ms } from "./motion.js";
  import { pointer } from "./pointer.svelte.js";

  interface Props {
    onpick: (activity: Activity) => void;
    onback: () => void;
    /** The sport already being built, which picking again keeps. */
    current?: string | undefined;
  }
  let { onpick, onback, current }: Props = $props();

  type Icon = typeof Bike;

  // One glyph per sport, from the app's one icon set. Indoor and outdoor share
  // theirs; the name already says which is which.
  const ICONS: Record<string, Icon> = {
    SWIMMING: WavesLadder,
    RUNNING: SportShoe,
    CYCLING: Bike,
    WALKING: Footprints,
    HIKING: Mountain,
    ROWING: Waves,
    ELLIPTICAL: Loop,
    STAIR_CLIMBING: TrendingUp,
    HIGH_INTENSITY_INTERVAL_TRAINING: Flame,
    CROSS_TRAINING: Pulse,
    FUNCTIONAL_STRENGTH_TRAINING: Weight,
    TRADITIONAL_STRENGTH_TRAINING: Dumbbell,
    CORE_TRAINING: Target,
    YOGA: Flower2,
  };

  // Most-used first. A sport the matrix gains later lands at the end of the
  // second group, named and with a generic glyph, rather than disappearing.
  const CARDIO = [
    "RUNNING",
    "CYCLING",
    "SWIMMING",
    "WALKING",
    "HIKING",
    "ROWING",
    "ELLIPTICAL",
    "STAIR_CLIMBING",
  ];
  const STUDIO = [
    "HIGH_INTENSITY_INTERVAL_TRAINING",
    "FUNCTIONAL_STRENGTH_TRAINING",
    "TRADITIONAL_STRENGTH_TRAINING",
    "CORE_TRAINING",
    "CROSS_TRAINING",
    "YOGA",
  ];

  let query = $state("");
  let field = $state<HTMLInputElement | undefined>(undefined);
  let grid = $state<HTMLDivElement | undefined>(undefined);

  /** Lower case without accents, so "natacion" finds Natación. */
  function plain(text: string): string {
    return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  }

  function rank(order: readonly string[], sport: string): number {
    const at = order.indexOf(sport);
    return at === -1 ? order.length : at;
  }

  let matches = $derived.by(() => {
    const wanted = plain(query.trim());
    return ACTIVITY_CATALOGUE.filter((activity) => {
      const haystack = plain(`${activityName(activity.id)} ${activity.sport.replace(/_/g, " ")}`);
      return haystack.includes(wanted);
    });
  });

  let sections = $derived(
    [
      {
        id: "cardio",
        title: t("picker.cardio"),
        activities: matches
          .filter((activity) => CARDIO.includes(activity.sport))
          .sort((a, b) => rank(CARDIO, a.sport) - rank(CARDIO, b.sport)),
      },
      {
        id: "studio",
        title: t("picker.studio"),
        activities: matches
          .filter((activity) => !CARDIO.includes(activity.sport))
          .sort((a, b) => rank(STUDIO, a.sport) - rank(STUDIO, b.sport)),
      },
    ].filter((section) => section.activities.length > 0),
  );

  let first = $derived(sections[0]?.activities[0]);

  $effect(() => {
    // On a phone the keyboard would cover half the choices before anyone asked for it.
    if (!pointer.coarse) field?.focus();
  });

  function tiles(): HTMLElement[] {
    return grid === undefined ? [] : [...grid.querySelectorAll<HTMLElement>("[data-tile]")];
  }

  function onSearchKey(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (first !== undefined) onpick(first);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      tiles()[0]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (query !== "") query = "";
      else onback();
    }
  }

  /**
   * The arrows move through the grid as it is laid out, row by row and column
   * by column, so they behave at two columns on a phone and four on a desk.
   * Up from the top row goes back to the search; typing goes there too.
   */
  function onTileKey(event: KeyboardEvent) {
    const all = tiles();
    const from = event.currentTarget as HTMLElement;
    const at = all.indexOf(from);

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      all[at + (event.key === "ArrowRight" ? 1 : -1)]?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const target = nearestRow(all, from, event.key === "ArrowDown" ? 1 : -1);
      if (target !== undefined) target.focus();
      else if (event.key === "ArrowUp") field?.focus();
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? all[0] : all.at(-1))?.focus();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onback();
      return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      field?.focus();
    }
  }

  function nearestRow(all: HTMLElement[], from: HTMLElement, by: 1 | -1): HTMLElement | undefined {
    const origin = from.getBoundingClientRect();
    const centre = origin.left + origin.width / 2;
    const rows = all
      .map((tile) => ({ tile, box: tile.getBoundingClientRect() }))
      .filter(({ box }) => (by === 1 ? box.top > origin.bottom - 4 : box.bottom < origin.top + 4));
    if (rows.length === 0) return undefined;
    const edge =
      by === 1 ? Math.min(...rows.map((r) => r.box.top)) : Math.max(...rows.map((r) => r.box.top));
    const row = rows.filter(({ box }) => Math.abs(box.top - edge) < 4);
    row.sort(
      (a, b) =>
        Math.abs(a.box.left + a.box.width / 2 - centre) -
        Math.abs(b.box.left + b.box.width / 2 - centre),
    );
    return row[0]?.tile;
  }
</script>

<BackButton label={t("nav.back")} onclick={onback} />

<div class="picker">
  <div class="panel" in:fly={{ y: 12, duration: ms(340) }}>
    <h1>{t("picker.heading")}</h1>

    <div class="search">
      <Search size={17} strokeWidth={2} />
      <input
        bind:this={field}
        bind:value={query}
        placeholder={t("picker.search")}
        aria-label={t("picker.search")}
        spellcheck="false"
        autocomplete="off"
        onkeydown={onSearchKey}
      />
      {#if query.trim() !== "" && first !== undefined && !pointer.coarse}
        <span class="hint"><Kbd label={keys.enter} /> {activityName(first.id)}</span>
      {/if}
    </div>

    <div class="sections" bind:this={grid}>
      {#each sections as section (section.id)}
        <section class={section.id}>
          <h2>{section.title}</h2>
          <div class="grid">
            {#each section.activities as activity (activity.id)}
              {@const Glyph = ICONS[activity.sport] ?? Pulse}
              <button
                type="button"
                class="tile"
                class:first={activity === first && query.trim() !== ""}
                data-tile
                onclick={() => onpick(activity)}
                onkeydown={onTileKey}
              >
                <span class="glyph"><Glyph size={20} strokeWidth={2} /></span>
                <span class="label">
                  <span class="name">{activityName(activity.id)}</span>
                  {#if current === activity.id}
                    <span class="badge">{t("picker.current")}</span>
                  {/if}
                </span>
              </button>
            {/each}
          </div>
        </section>
      {/each}

      {#if sections.length === 0}
        <p class="none">{t("picker.noMatch", { query })}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .picker {
    height: 100%;
    display: grid;
    place-items: start center;
    padding: 11vh 24px 48px;
    overflow-y: auto;
  }

  .panel {
    width: min(760px, 100%);
  }

  h1 {
    margin: 0 0 20px;
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.025em;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 8px 0 14px;
    border: 1px solid var(--hairline-strong);
    border-radius: 11px;
    background: var(--bg-surface);
    color: var(--text-tertiary);
    transition:
      border-color 120ms var(--ease),
      box-shadow 120ms var(--ease);
  }

  .search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  input {
    flex: 1;
    width: 0;
    min-width: 0;
    height: 100%;
    font-size: 16px;
    color: var(--text-primary);
  }

  input::placeholder {
    color: var(--text-tertiary);
  }

  .hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    padding-right: 4px;
    color: var(--text-tertiary);
    font-size: 12.5px;
  }

  .sections {
    display: grid;
    gap: 28px;
    margin-top: 28px;
  }

  h2 {
    margin: 0 0 10px;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 8px;
  }

  /* Each group gets its own tint on the glyph, so cardio and the gym read
     apart at a glance; the tiles themselves stay quiet. */
  .cardio {
    --tint: #2f8a3a;
    --tint-soft: #e6f3e2;
  }

  .studio {
    --tint: #b4590c;
    --tint-soft: #fbeadb;
  }

  :global(:root:not([data-theme="light"])) .cardio {
    --tint: #8fdc7a;
    --tint-soft: rgba(143, 220, 122, 0.13);
  }

  :global(:root:not([data-theme="light"])) .studio {
    --tint: #f6b26b;
    --tint-soft: rgba(246, 178, 107, 0.13);
  }

  .tile {
    position: relative;
    display: grid;
    align-content: start;
    justify-items: start;
    gap: 12px;
    min-height: 104px;
    padding: 14px;
    border: 1px solid var(--hairline);
    border-radius: 12px;
    background: var(--bg-surface);
    text-align: left;
    transition:
      border-color 120ms var(--ease),
      background 120ms var(--ease),
      box-shadow 120ms var(--ease);
  }

  .tile:hover {
    border-color: var(--hairline-strong);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .tile.first {
    border-color: var(--accent);
  }

  .glyph {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--tint-soft);
    color: var(--tint);
  }

  .name {
    font-size: 14.5px;
    font-weight: 500;
    line-height: 1.3;
  }

  .badge {
    position: absolute;
    top: 14px;
    right: 14px;
    padding: 2px 7px;
    border-radius: var(--radius-pill);
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 11.5px;
    font-weight: 600;
  }

  .none {
    margin: 0;
    color: var(--text-tertiary);
    font-size: 14px;
  }

  @media (max-width: 640px) {
    .picker {
      padding: 64px 16px 32px;
    }

    h1 {
      font-size: 23px;
    }

    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    /* A row each on a phone: the glyph beside the name keeps all eighteen
       within a couple of screens instead of a long column of tall cards. */
    .tile {
      grid-template-columns: 32px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      min-height: 60px;
      padding: 10px 12px;
    }

    .glyph {
      width: 32px;
      height: 32px;
      border-radius: 9px;
    }

    .label {
      display: grid;
      gap: 3px;
    }

    .name {
      font-size: 14px;
    }

    .badge {
      position: static;
      justify-self: start;
      font-size: 10.5px;
    }

    .hint {
      display: none;
    }
  }
</style>
