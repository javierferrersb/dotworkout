<script lang="ts">
  import type { Snippet } from "svelte";
  import { t } from "../../i18n/locale.svelte.js";

  interface Props {
    label: string;
    field: string;
    optional?: boolean;
    /** Required and still empty: the field the step is waiting on. */
    missing?: boolean;
    note?: string | undefined;
    children: Snippet;
  }
  let { label, field, optional = false, missing = false, note, children }: Props = $props();
</script>

<div class="row" data-field={field} data-missing={missing}>
  <span class="label">
    {label}
    {#if optional}<span class="optional">{t("field.optional")}</span>{/if}
  </span>
  <div class="control">
    {@render children()}
    {#if note}<p class="note">{note}</p>{/if}
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: var(--label-column, 104px) minmax(0, 1fr);
    gap: 4px 12px;
    align-items: start;
  }

  .label {
    display: grid;
    padding-top: 7px;
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.35;
  }

  .optional {
    color: var(--text-tertiary);
    font-size: 11.5px;
  }

  .control {
    display: grid;
    justify-items: start;
    gap: 6px;
    min-width: 0;
  }

  .note {
    margin: 0;
    max-width: 420px;
    color: var(--text-tertiary);
    font-size: 12.5px;
    line-height: 1.4;
  }

  @media (max-width: 560px) {
    .row {
      grid-template-columns: minmax(0, 1fr);
    }

    .label {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding-top: 0;
    }
  }
</style>
