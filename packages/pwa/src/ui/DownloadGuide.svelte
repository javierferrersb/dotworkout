<script lang="ts">
  import { t } from "../i18n/locale.svelte.js";
</script>

<section>
  <h2>{t("guide.heading")}</h2>

  <ol>
    <li>
      <svg viewBox="0 0 100 72" aria-hidden="true">
        <rect class="edge" x="26" y="2" width="48" height="68" rx="9" />
        <g class="faint">
          <line x1="33" y1="14" x2="60" y2="14" />
          <line x1="33" y1="21" x2="67" y2="21" />
          <line x1="33" y1="28" x2="55" y2="28" />
        </g>
        <rect class="fill" x="31" y="53" width="22" height="12" rx="6" />
        <line class="faint" x1="35" y1="59" x2="48" y2="59" />
        <circle class="ring" cx="63" cy="59" r="8" />
        <circle class="accent" cx="63" cy="59" r="5.5" />
        <path class="glyph" d="M63 56.2v5m-2-2.1L63 61.3l2-2.2" />
      </svg>
      <p>
        {t("guide.step1")}
        <span class="note">{t("guide.step1.note")}</span>
      </p>
    </li>

    <li>
      <svg viewBox="0 0 100 72" aria-hidden="true">
        <rect class="edge fill" x="22" y="8" width="56" height="56" rx="9" />
        <line class="faint" x1="29" y1="19" x2="58" y2="19" />
        <rect class="pick" x="26" y="26" width="48" height="16" rx="5" />
        <path class="accentEdge" d="M33 31v6m-2.2-2.2L33 37.2l2.2-2.4" />
        <line class="faint" x1="41" y1="34" x2="66" y2="34" />
        <line class="faint" x1="29" y1="50" x2="56" y2="50" />
        <line class="faint" x1="29" y1="58" x2="47" y2="58" />
      </svg>
      <p>{t("guide.step2")}</p>
    </li>

    <li>
      <svg viewBox="0 0 100 72" aria-hidden="true">
        <rect class="edge fill" x="14" y="9" width="72" height="54" rx="9" />
        <line class="faint bold" x1="21" y1="19" x2="45" y2="19" />
        <rect class="pick" x="19" y="27" width="62" height="17" rx="6" />
        <rect class="accentEdge" x="24" y="30.5" width="8" height="10" rx="1.5" />
        <g class="faint">
          <line x1="37" y1="34" x2="64" y2="34" />
          <line x1="37" y1="39" x2="55" y2="39" />
          <line x1="24" y1="52" x2="48" y2="52" />
          <line x1="24" y1="57" x2="38" y2="57" />
        </g>
      </svg>
      <p>{t("guide.step3")}</p>
    </li>

    <li>
      <svg viewBox="0 0 100 72" aria-hidden="true">
        <rect class="faint" x="41" y="5" width="18" height="13" rx="4" />
        <rect class="faint" x="41" y="54" width="18" height="13" rx="4" />
        <rect class="edge" x="33" y="15" width="34" height="42" rx="10" />
        <path class="check" d="M42 36.5l5.5 5.5L59 30" />
      </svg>
      <p>{t("guide.step4")}</p>
    </li>
  </ol>
</section>

<style>
  section {
    text-align: left;
    padding: 16px 16px 14px;
    border-radius: 16px;
    background: var(--bg-sunken);
  }

  h2 {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }

  li {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  svg {
    flex: none;
    width: 76px;
    height: 55px;
  }

  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text-secondary);
  }

  .note {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .edge,
  .faint,
  .ring,
  .accentEdge,
  .check,
  .glyph {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .edge {
    stroke: var(--text-tertiary);
    stroke-width: 2;
  }

  .faint {
    stroke: var(--text-tertiary);
    stroke-width: 2;
    opacity: 0.45;
  }

  .bold {
    stroke-width: 3;
    opacity: 0.7;
  }

  .fill {
    fill: var(--bg-raised);
    stroke: none;
  }

  .edge.fill {
    fill: var(--bg-raised);
    stroke: var(--text-tertiary);
  }

  .pick {
    fill: var(--accent-soft);
    stroke: var(--accent-edge);
    stroke-width: 1.5;
  }

  .accent {
    fill: var(--accent);
  }

  .accentEdge {
    stroke: var(--accent);
    stroke-width: 1.8;
  }

  .ring {
    stroke: var(--accent);
    stroke-width: 1.6;
    opacity: 0.35;
  }

  .glyph {
    stroke: var(--on-accent);
    stroke-width: 1.7;
  }

  .check {
    stroke: var(--accent);
    stroke-width: 3.4;
  }
</style>
