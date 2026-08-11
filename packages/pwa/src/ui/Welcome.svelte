<script lang="ts">
  import { fly } from "svelte/transition";
  import { Heart } from "@lucide/svelte";
  import { KEY } from "./platform.js";

  interface Props {
    oncontinue: () => void;
  }
  let { oncontinue }: Props = $props();

  const FIXES = [
    {
      title: "Series and repetitions in seconds",
      body: "8 × 400 m with 90 seconds recovery takes four keystrokes here. On the phone it takes forty taps.",
    },
    {
      title: "Target a heart-rate zone",
      body: "Pin any interval to a zone, a pace, a cadence or a power number, and only the ones your sport actually supports are offered.",
    },
    {
      title: "Straight onto the Watch",
      body: "Get a real .workout file. Send it to yourself, open it in the Workouts app, and it syncs across.",
    },
  ];
</script>

<div class="welcome">
  <div class="panel" in:fly={{ y: 16, duration: 420 }}>
    <h1>Build <em>Apple&nbsp;Watch workouts</em> on a proper keyboard.</h1>
    <p class="lede">
      Apple only lets you create custom workouts by tapping them out on your phone. Build them on
      your computer instead — intervals, repetitions and heart-rate zones — then send the file
      straight to your watch.
    </p>

    <ul>
      {#each FIXES as fix (fix.title)}
        <li>
          <h2>{fix.title}</h2>
          <p>{fix.body}</p>
        </li>
      {/each}
    </ul>

    <button class="start" onclick={oncontinue}>
      Build a workout
      <span class="key">{KEY.enter}</span>
    </button>

    <p class="privacy">
      Runs entirely on your device. Nothing is uploaded, and it works offline once installed.
    </p>

    <footer>
      Made with <Heart class="heart" size={14} strokeWidth={0} fill="currentColor" /> in Spain by
      <a href="https://github.com/javierferrersb" target="_blank" rel="noopener noreferrer">
        javierferrersb
      </a>
    </footer>
  </div>
</div>

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

  h1 {
    margin: 0 0 18px;
    font-size: clamp(32px, 5vw, 48px);
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

  footer :global(.heart) {
    color: var(--accent);
    vertical-align: -2px;
  }

  a {
    color: var(--text-secondary);
    text-decoration: none;
    border-bottom: 1px solid var(--hairline);
  }

  a:hover {
    color: var(--accent);
    border-bottom-color: var(--accent-edge);
  }
</style>
