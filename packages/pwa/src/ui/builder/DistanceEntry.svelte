<script lang="ts">
  import { untrack } from "svelte";
  import type { Distance, DistanceUnit } from "@dotworkout/domain";
  import { DISTANCE_UNITS, numberText, readDistance } from "../../application/stepEdit.js";
  import { t } from "../../i18n/locale.svelte.js";
  import Entry from "./Entry.svelte";

  interface Props {
    label: string;
    distance: Distance | undefined;
    fallbackUnit: DistanceUnit;
    oncommit: (distance: Distance | undefined) => void;
  }
  let { label, distance, fallbackUnit, oncommit }: Props = $props();

  // The unit lives beside the number, never inside it, so reopening a step
  // shows 400 m as 400 and m rather than a bare 400 that reads back as km.
  let unit = $state<DistanceUnit>(untrack(() => distance?.unit ?? fallbackUnit));
  $effect(() => {
    if (distance !== undefined) unit = distance.unit;
  });

  let units = $derived(
    distance !== undefined && !DISTANCE_UNITS.includes(distance.unit)
      ? [...DISTANCE_UNITS, distance.unit]
      : DISTANCE_UNITS,
  );

  // Running counts in kilometres, so a bare 400 is 400 km. That is never
  // guessed away; a value no step is that long gets a one-tap way out instead.
  let smaller = $derived<DistanceUnit | undefined>(
    distance === undefined || distance.value < 50
      ? undefined
      : distance.unit === "km"
        ? "m"
        : distance.unit === "mi"
          ? "yd"
          : undefined,
  );

  function read(text: string) {
    oncommit(text === "" ? undefined : readDistance(text, unit));
  }

  function changeUnit() {
    if (distance !== undefined) oncommit({ value: distance.value, unit });
  }
</script>

<div class="distance">
  <Entry
    value={distance === undefined ? "" : numberText(distance.value)}
    {label}
    placeholder="0"
    required
    inputmode="decimal"
    size="medium"
    {read}
  >
    {#snippet trailing()}
      <select bind:value={unit} onchange={changeUnit} aria-label={t("field.unit")}>
        {#each units as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    {/snippet}
  </Entry>
  {#if smaller !== undefined && distance !== undefined}
    {@const fix = smaller}
    <button
      type="button"
      class="hint"
      onclick={() => oncommit({ value: distance.value, unit: fix })}
    >
      {t("field.unitHint", { value: `${numberText(distance.value)} ${fix}` })}
    </button>
  {/if}
</div>

<style>
  .distance {
    display: grid;
    justify-items: start;
    gap: 6px;
    width: 100%;
  }

  .hint {
    padding: 0;
    color: var(--warn);
    font-size: 12.5px;
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  select {
    flex: none;
    height: 26px;
    padding: 0 6px;
    border: none;
    border-radius: 5px;
    background: var(--bg-raised);
    color: var(--text-secondary);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
