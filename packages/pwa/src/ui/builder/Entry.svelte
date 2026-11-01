<script lang="ts">
  import type { Snippet } from "svelte";
  import { untrack } from "svelte";
  import { FieldError } from "../../application/stepEdit.js";
  import { t } from "../../i18n/locale.svelte.js";

  interface Props {
    /** The stored value written as it would be typed. */
    value: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    inputmode?: "text" | "numeric" | "decimal";
    size?: "short" | "medium" | "wide";
    suffix?: string;
    /** Takes the trimmed text, empty to clear; throws a FieldError when it cannot. */
    read: (text: string) => void;
    trailing?: Snippet;
  }
  let {
    value,
    label,
    placeholder = "",
    required = false,
    inputmode = "text",
    size = "medium",
    suffix,
    read,
    trailing,
  }: Props = $props();

  const problemId = `problem-${Math.random().toString(36).slice(2, 9)}`;

  let text = $state(untrack(() => value));
  let problem = $state<string | undefined>(undefined);
  let focused = false;

  // Follow the stored value (an undo, another field changing it) while not
  // being typed into; mid-typing, the text is the person's and stays put.
  $effect(() => {
    const next = value;
    if (!untrack(() => focused)) {
      text = next;
      problem = undefined;
    }
  });

  /** Writes the text through if it reads; reports why not unless asked to stay quiet. */
  function attempt(quiet: boolean): boolean {
    const clean = text.trim();
    if (clean === "") {
      if (required) {
        if (!quiet) problem = t("field.error.required");
        return false;
      }
      read("");
      problem = undefined;
      return true;
    }
    try {
      read(clean);
      problem = undefined;
      return true;
    } catch (error) {
      if (!quiet) problem = error instanceof FieldError ? t(error.key) : String(error);
      return false;
    }
  }

  function oninput() {
    // Values land as they are typed so the step line and the total follow,
    // but a complaint waits until the person has finished, unless one is up.
    attempt(problem === undefined);
  }

  function onblur() {
    focused = false;
    if (text.trim() === "" && required) {
      problem = undefined;
      return;
    }
    if (attempt(false)) text = value;
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.isComposing && !attempt(false)) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (event.key === "Escape" && problem !== undefined) {
      text = value;
      problem = undefined;
    }
  }
</script>

<div class="entry {size}" class:invalid={problem !== undefined}>
  <div class="box">
    <input
      bind:value={text}
      {placeholder}
      {inputmode}
      aria-label={label}
      aria-invalid={problem !== undefined}
      aria-describedby={problem === undefined ? undefined : problemId}
      autocomplete="off"
      spellcheck="false"
      onfocus={() => (focused = true)}
      {oninput}
      {onblur}
      {onkeydown}
    />
    {#if suffix}<span class="suffix">{suffix}</span>{/if}
    {@render trailing?.()}
  </div>
  {#if problem}<p class="problem" id={problemId}>{problem}</p>{/if}
</div>

<style>
  .entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 5px;
    width: 100%;
  }

  .short {
    max-width: 112px;
  }

  .medium {
    max-width: 176px;
  }

  .wide {
    max-width: 320px;
  }

  .box {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 4px 0 10px;
    border: 1px solid var(--hairline-strong);
    border-radius: var(--radius-control);
    background: var(--bg-surface);
    transition:
      border-color 120ms var(--ease),
      box-shadow 120ms var(--ease);
  }

  .box:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  .invalid .box {
    border-color: var(--danger);
  }

  .invalid .box:focus-within {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
  }

  input {
    flex: 1;
    width: 0;
    min-width: 0;
    height: 100%;
    font-size: 15px;
    font-weight: 500;
  }

  input::placeholder {
    color: var(--text-tertiary);
    font-weight: 400;
  }

  .suffix {
    flex: none;
    padding-right: 6px;
    color: var(--text-tertiary);
    font-size: 13px;
  }

  .problem {
    margin: 0;
    color: var(--danger);
    font-size: 12.5px;
    line-height: 1.35;
  }
</style>
