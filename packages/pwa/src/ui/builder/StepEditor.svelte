<script lang="ts">
  import { tick } from "svelte";
  import { ArrowDown, ArrowUp, Copy, Trash2 } from "@lucide/svelte";
  import type { CompositionSession, Step } from "../../application/compositionSession.svelte.js";
  import {
    changeGoal,
    changeKind,
    durationText,
    rangeEnds,
    readDuration,
    readTarget,
    targetStyle,
    targetText,
    targetValue,
    withBound,
    withDistance,
    withDuration,
    withLabel,
    withReading,
    withRepetitions,
    withStyle,
    withTarget,
    withValue,
    withZone,
    type DurationField,
  } from "../../application/stepEdit.js";
  import type { AlertMetric, AlertReading, AlertStyle, GoalKind } from "../../domain/activity.js";
  import type { BlockKind } from "../../domain/block.js";
  import { isAnswered, type Question } from "../../domain/interview.js";
  import {
    blockKindName,
    choiceText,
    fieldName,
    questionNote,
    targetUnit,
  } from "../../i18n/format.js";
  import { keys } from "../../i18n/keys.svelte.js";
  import { t } from "../../i18n/locale.svelte.js";
  import Kbd from "../Kbd.svelte";
  import CountEntry from "./CountEntry.svelte";
  import DistanceEntry from "./DistanceEntry.svelte";
  import Entry from "./Entry.svelte";
  import FieldRow from "./FieldRow.svelte";
  import Segmented from "./Segmented.svelte";

  interface Props {
    session: CompositionSession;
    entry: Step;
    index: number;
    ondone: () => void;
    onremove: () => void;
  }
  let { session, entry, index, ondone, onremove }: Props = $props();

  let root = $state<HTMLDivElement | undefined>(undefined);

  let id = $derived(entry.id);
  let draft = $derived(entry.draft);
  let sport = $derived(session.activity.sport);
  let fields = $derived(session.fieldsAt(index).filter((question) => question.id !== "kind"));
  let metric = $derived<AlertMetric | undefined>(
    draft.alertMetric === undefined || draft.alertMetric === "NONE" ? undefined : draft.alertMetric,
  );
  let style = $derived(targetStyle(draft));
  let ends = $derived(rangeEnds(draft));

  let kindOptions = $derived(
    session.kindsAt(index).map((kind) => ({ value: kind, label: blockKindName(kind) })),
  );

  function edit(change: Parameters<CompositionSession["edit"]>[1], key?: string) {
    session.edit(id, change, key);
  }

  function options(question: Question) {
    if (question.form.type !== "choice") return [];
    return question.form.choices.map((choice) => ({
      value: choice.value,
      label: choiceText(choice, sport),
      note: choice.caution ? t("prompt.notVerified") : undefined,
    }));
  }

  function missing(question: Question): boolean {
    return !question.optional && !isAnswered(draft, question.id);
  }

  function durationOf(field: DurationField) {
    return field === "duration"
      ? draft.duration
      : field === "sendOff"
        ? draft.sendOff
        : draft.recovery;
  }

  function readClock(field: DurationField, text: string) {
    const value = text === "" ? undefined : readDuration(text);
    edit((current) => withDuration(current, field, value), field);
  }

  function readNumber(text: string, apply: (value: number | undefined) => void) {
    if (metric === undefined) return;
    apply(text === "" ? undefined : readTarget(metric, text, sport));
  }

  // Keyboard: Enter or the down arrow goes to the next field, up to the one
  // before, Escape closes. Enter past the last field finishes the step.
  function focusable(within: Element | null | undefined): HTMLElement | undefined {
    if (within === null || within === undefined) return undefined;
    return (
      within.querySelector<HTMLElement>("input, [role='radio'][tabindex='0'], textarea") ??
      undefined
    );
  }

  function focusField(target: HTMLElement | undefined) {
    if (target === undefined) return;
    target.focus();
    if (target instanceof HTMLInputElement) target.select();
  }

  function rows(): HTMLElement[] {
    return root === undefined ? [] : [...root.querySelectorAll<HTMLElement>("[data-field]")];
  }

  function move(from: HTMLElement, by: 1 | -1): boolean {
    const all = rows();
    const at = all.findIndex((row) => row.contains(from));
    if (at === -1) return false;

    // A row can hold two inputs, the two ends of a range.
    const inputs = [...(all[at]?.querySelectorAll<HTMLElement>("input") ?? [])];
    const within = inputs.indexOf(from);
    if (within !== -1 && inputs[within + by] !== undefined) {
      focusField(inputs[within + by]);
      return true;
    }

    for (let next = at + by; next >= 0 && next < all.length; next += by) {
      const target = focusable(all[next]);
      if (target !== undefined) {
        focusField(target);
        return true;
      }
    }
    return false;
  }

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      ondone();
      return;
    }
    if (target.closest("[data-field]") === null || target.tagName === "SELECT") return;
    const isChip = target.tagName === "BUTTON" && target.getAttribute("role") !== "radio";
    if (isChip) return;

    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!move(target, 1)) ondone();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      move(target, event.key === "ArrowDown" ? 1 : -1);
    }
  }

  $effect(() => {
    const request = session.focusRequest;
    if (request === undefined || request.id !== id) return;
    void tick().then(() => {
      const waiting = root?.querySelector("[data-field][data-missing='true']");
      focusField(
        focusable(waiting) ?? focusable(root?.querySelector("[data-field] + [data-field]")),
      );
      session.focusRequest = undefined;
    });
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="editor" bind:this={root} {onkeydown}>
  <FieldRow label={t("field.kind")} field="kind">
    <Segmented
      label={t("field.kind")}
      options={kindOptions}
      selected={draft.kind}
      onselect={(value) =>
        edit((current) => changeKind(current, value as BlockKind, session.capabilities))}
    />
  </FieldRow>

  {#each fields as question (question.id)}
    {@const label = fieldName(question.id, draft, sport)}
    {@const note = questionNote(question)}
    {#if question.id === "goal"}
      <FieldRow {label} field="goal" missing={missing(question)}>
        <Segmented
          {label}
          options={options(question)}
          selected={draft.goalKind}
          onselect={(value) => edit((current) => changeGoal(current, value as GoalKind))}
        />
      </FieldRow>
    {:else if question.id === "distance"}
      <FieldRow {label} field="distance" missing={missing(question)}>
        <DistanceEntry
          {label}
          distance={draft.distance}
          fallbackUnit={session.activity.defaultDistanceUnit}
          oncommit={(value) => edit((current) => withDistance(current, value), "distance")}
        />
      </FieldRow>
    {:else if question.id === "duration" || question.id === "sendOff" || question.id === "recovery"}
      {@const field = question.id}
      <FieldRow {label} {field} optional={question.optional} missing={missing(question)} {note}>
        <Entry
          value={durationText(durationOf(field))}
          {label}
          placeholder={"placeholder" in question.form ? question.form.placeholder : ""}
          required={!question.optional}
          inputmode="numeric"
          size="short"
          read={(text) => readClock(field, text)}
        />
      </FieldRow>
    {:else if question.id === "repetitions"}
      <FieldRow {label} field="repetitions" missing={missing(question)}>
        <CountEntry
          {label}
          count={draft.repetitions}
          placeholder="8"
          oncommit={(value) => edit((current) => withRepetitions(current, value), "repetitions")}
        />
      </FieldRow>
    {:else if question.id === "alert"}
      <FieldRow {label} field="alert" optional>
        <Segmented
          {label}
          options={options(question)}
          selected={draft.alertMetric ?? "NONE"}
          onselect={(value) =>
            edit((current) => withTarget(current, value as AlertMetric | "NONE"))}
        />
      </FieldRow>
    {:else if question.id === "alertReading"}
      <FieldRow {label} field="alertReading" {note}>
        <Segmented
          {label}
          options={options(question)}
          selected={draft.alertReading}
          onselect={(value) => edit((current) => withReading(current, value as AlertReading))}
        />
      </FieldRow>
    {:else if question.id === "alertStyle"}
      <FieldRow {label} field="alertStyle">
        <Segmented
          {label}
          options={options(question)}
          selected={style}
          onselect={(value) => edit((current) => withStyle(current, value as AlertStyle))}
        />
      </FieldRow>
    {:else if question.id === "alertFrom" && metric !== undefined}
      <FieldRow
        label={t("field.range")}
        field="range"
        missing={draft.alert === undefined}
        note={metric === "SPEED" ? undefined : note}
      >
        <div class="range">
          <Entry
            value={targetText(metric, ends.from, sport)}
            label={t("question.from")}
            placeholder={"placeholder" in question.form ? question.form.placeholder : ""}
            required
            inputmode="decimal"
            size="short"
            read={(text) =>
              readNumber(text, (value) =>
                edit((current) => withBound(current, "from", value), "from"),
              )}
          />
          <span class="dash">–</span>
          <Entry
            value={targetText(metric, ends.to, sport)}
            label={t("question.to")}
            required
            inputmode="decimal"
            size="short"
            suffix={targetUnit(metric, sport)}
            read={(text) =>
              readNumber(text, (value) => edit((current) => withBound(current, "to", value), "to"))}
          />
        </div>
      </FieldRow>
    {:else if question.id === "alertValue" && style !== "RANGE" && metric !== undefined}
      {#if question.form.type === "choice"}
        <FieldRow {label} field="zone" missing={missing(question)} {note}>
          <Segmented
            {label}
            options={options(question)}
            selected={draft.alert?.metric === "HEART_RATE" && draft.alert.style === "ZONE"
              ? String(draft.alert.zone)
              : undefined}
            onselect={(value) => edit((current) => withZone(current, Number(value)))}
          />
        </FieldRow>
      {:else}
        <FieldRow {label} field="target" missing={missing(question)}>
          <Entry
            value={targetText(metric, targetValue(draft), sport)}
            {label}
            placeholder={"placeholder" in question.form ? question.form.placeholder : ""}
            required
            inputmode="decimal"
            size="short"
            suffix={targetUnit(metric, sport)}
            read={(text) =>
              readNumber(text, (value) => edit((current) => withValue(current, value), "target"))}
          />
        </FieldRow>
      {/if}
    {:else if question.id === "label" && question.form.type === "text"}
      <FieldRow {label} field="label" optional {note}>
        <Entry
          value={draft.label ?? ""}
          {label}
          size="wide"
          read={(text) => edit((current) => withLabel(current, text), "label")}
        />
        <div class="suggestions">
          {#each question.form.suggestions as key (key)}
            {@const word = t(key)}
            <button
              type="button"
              class="chip"
              class:on={draft.label === word}
              onclick={() =>
                edit((current) => withLabel(current, current.label === word ? "" : word))}
            >
              {word}
            </button>
          {/each}
        </div>
      </FieldRow>
    {/if}
  {/each}

  <footer>
    <div class="tools">
      {#if session.canMove(id, -1)}
        <button
          type="button"
          class="icon"
          aria-label={t("step.moveUp")}
          title={t("step.moveUp")}
          onclick={() => session.move(id, -1)}
        >
          <ArrowUp size={15} strokeWidth={2} />
        </button>
      {/if}
      {#if session.canMove(id, 1)}
        <button
          type="button"
          class="icon"
          aria-label={t("step.moveDown")}
          title={t("step.moveDown")}
          onclick={() => session.move(id, 1)}
        >
          <ArrowDown size={15} strokeWidth={2} />
        </button>
      {/if}
      {#if session.canDuplicate(id)}
        <button type="button" class="ghost" onclick={() => session.duplicate(id)}>
          <Copy size={14} strokeWidth={2} />
          {t("step.duplicate")}
        </button>
      {/if}
      <button type="button" class="ghost danger" onclick={onremove}>
        <Trash2 size={14} strokeWidth={2} />
        {t("step.remove")}
      </button>
    </div>
    <button type="button" class="done" onclick={ondone}>
      {t("step.done")}
      <Kbd label={keys.enter} tone="onAccent" />
    </button>
  </footer>
</div>

<style>
  .editor {
    display: grid;
    gap: 14px;
    padding: 16px 16px 14px;
    border-top: 1px solid var(--hairline);
  }

  .range {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
  }

  .range > :global(.entry) {
    flex: 0 1 112px;
  }

  .dash {
    padding-top: 7px;
    color: var(--text-tertiary);
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    padding: 3px 9px;
    border: 1px solid var(--hairline-strong);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 12.5px;
    transition:
      background 100ms var(--ease),
      color 100ms var(--ease);
  }

  .chip:hover {
    background: var(--bg-raised);
    color: var(--text-primary);
  }

  .chip.on {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--on-ink);
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 2px;
    padding-top: 12px;
    border-top: 1px solid var(--hairline);
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    margin-left: -8px;
  }

  .ghost,
  .icon {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 8px;
    border-radius: var(--radius-control);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    transition:
      background 100ms var(--ease),
      color 100ms var(--ease);
  }

  .icon {
    width: 30px;
    justify-content: center;
    padding: 0;
  }

  .ghost:hover,
  .icon:hover {
    background: var(--bg-raised);
    color: var(--text-primary);
  }

  .danger:hover {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
  }

  .done {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 6px 0 12px;
    border-radius: var(--radius-control);
    background: var(--ink);
    color: var(--on-ink);
    font-size: 13.5px;
    font-weight: 600;
    transition: background 120ms var(--ease);
  }

  .done:hover {
    background: var(--ink-hover);
  }

  @media (max-width: 560px) {
    .editor {
      padding: 14px 14px 12px;
    }

    .done :global(kbd) {
      display: none;
    }

    .done {
      padding: 0 14px;
    }
  }
</style>
