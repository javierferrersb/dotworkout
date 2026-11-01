<script lang="ts">
  import { Minus, Plus } from "@lucide/svelte";
  import { readCount } from "../../application/stepEdit.js";
  import { t } from "../../i18n/locale.svelte.js";
  import Entry from "./Entry.svelte";

  interface Props {
    label: string;
    count: number | undefined;
    placeholder: string;
    oncommit: (count: number | undefined) => void;
  }
  let { label, count, placeholder, oncommit }: Props = $props();

  function read(text: string) {
    oncommit(text === "" ? undefined : readCount(text));
  }

  // Shift-click moves by five, for the long sets a single step makes tedious.
  function nudge(event: MouseEvent, by: number) {
    const step = event.shiftKey ? by * 5 : by;
    oncommit(Math.max(1, (count ?? 0) + step));
  }
</script>

<div class="count">
  <Entry
    value={count === undefined ? "" : String(count)}
    {label}
    {placeholder}
    required
    inputmode="numeric"
    size="short"
    {read}
  />
  <div class="stepper">
    <button
      type="button"
      tabindex="-1"
      aria-label={t("field.decrease")}
      disabled={count === undefined || count <= 1}
      onclick={(event) => nudge(event, -1)}
    >
      <Minus size={14} strokeWidth={2} />
    </button>
    <span class="divider"></span>
    <button
      type="button"
      tabindex="-1"
      aria-label={t("field.increase")}
      onclick={(event) => nudge(event, 1)}
    >
      <Plus size={14} strokeWidth={2} />
    </button>
  </div>
</div>

<style>
  .count {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
  }

  .count > :global(.entry) {
    flex: 0 1 88px;
  }

  .stepper {
    flex: none;
    display: flex;
    align-items: center;
    height: 34px;
    padding: 2px;
    border-radius: var(--radius-control);
    background: var(--bg-raised);
  }

  button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 100%;
    border-radius: 6px;
    color: var(--text-secondary);
  }

  button:hover:not(:disabled) {
    background: var(--segment-on);
    color: var(--text-primary);
  }

  button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .divider {
    width: 1px;
    height: 14px;
    background: var(--hairline-strong);
  }
</style>
