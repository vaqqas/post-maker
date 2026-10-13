/* ------------------------------------------------------------------ *
 * Layout: "Stack"
 *
 * Title and signature use the same two-cell table as "Side by side", but hug
 * the centre (Hindi right, Urdu left). The body is NOT paired by index: the
 * whole Hindi body is printed first, then the whole Urdu body below it, each
 * line full width and centered on the page.
 *
 * The body is printed exactly as typed — this layout adds no couplet spacing
 * of its own, so blank rows appear only where the user left a blank line.
 *
 * Like "Side by side" this is a single, capacity-limited page: lines that
 * don't fit are dropped and #bodyWarning says how many.
 *
 * Relies on shared helpers from app.js (buildPairTable, buildFooter,
 * frameInnerHeight, makeLineDiv, measureTextWidth, fontRowHeight, …).
 * ------------------------------------------------------------------ */
(function () {
  const ID = "stack";

  function pageCount() {
    return 1; // capacity-limited single page
  }

  function renderPage(/* page */) {
    const frame = els.frame;

    const title = buildPairTable("Title");

    const bodyArea = document.createElement("div");
    bodyArea.className = "bodyArea stackBody";
    bodyArea.style.marginTop = `${BODY_GAP}px`;

    const signature = buildPairTable("Signature");
    signature.style.marginTop = `${BODY_GAP}px`;

    const footer = buildFooter();

    frame.append(title, bodyArea, signature, footer);

    // Height available to the body = frame inner − title − signature − footer −
    // the two equal gaps (measured live, after the pieces are in the DOM).
    const availableH =
      frameInnerHeight() -
      title.offsetHeight -
      signature.offsetHeight -
      footer.offsetHeight -
      2 * BODY_GAP;

    buildLines(bodyArea, availableH);
  }

  /*
   * Lines exactly as typed. Unlike the shared `splitLines()`, blank lines are
   * NOT dropped — they survive as empty rows, so the spacing in the textarea
   * is the spacing on the page. Trailing blanks are trimmed, since those are
   * almost always a stray Enter at the end of the box rather than intent.
   */
  function typedLines(text) {
    const lines = (text || "").split("\n");
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    return lines;
  }

  /*
   * The row plan for the whole body, in print order: every Hindi line, then a
   * separator, then every Urdu line.
   *
   * This layout inserts **no** rhythm of its own — no empty row after every
   * two lines, the way `sideBySide` and `onePair` group couplets. A blank row
   * appears only where the user typed a blank line. The one exception is the
   * separator between the Hindi and Urdu blocks, which is structural (it keeps
   * the two languages from colliding), not text formatting.
   *
   * Row height is per language (each block uses its own font's measured line
   * height) so a tall Nastaliq block doesn't force the Hindi rows to match it.
   */
  function planRows(hLines, uLines, hRowH, uRowH) {
    const rows = [];

    const addBlock = (lines, rowH, lang) => {
      lines.forEach((text) => {
        rows.push(
          text.trim() === ""
            ? { kind: "spacer", h: rowH }
            : { kind: "line", text, lang, h: rowH }
        );
      });
    };

    addBlock(hLines, hRowH, "hindi");
    // Separator between the two blocks (only when both are present).
    if (hLines.length && uLines.length) {
      rows.push({ kind: "spacer", h: Math.max(hRowH, uRowH) });
    }
    addBlock(uLines, uRowH, "urdu");

    return rows;
  }

  // Keep rows while they fit in `availableH`; drop any spacer left dangling at
  // the end of a truncated plan.
  function fitRows(rows, availableH) {
    const kept = [];
    let used = 0;
    for (const row of rows) {
      if (used + row.h > availableH) break;
      used += row.h;
      kept.push(row);
    }
    while (kept.length && kept[kept.length - 1].kind === "spacer") kept.pop();
    return kept;
  }

  function buildLines(container, availableH) {
    const enabled = getEnabled();

    const hb = controls.hindiBody;
    const ub = controls.urduBody;
    const hLines = enabled.hindi ? typedLines(hb.text.value) : [];
    const uLines = enabled.urdu ? typedLines(ub.text.value).map(urduText) : [];

    const hStyle = lineStyleFor(hb, els.hindiFontSelect.value);
    const uStyle = lineStyleFor(ub, els.urduFontSelect.value);
    // Each block is measured on its own font, hence the one-language flags.
    const hRowH = fontRowHeight({ hindi: true, urdu: false }, hStyle, uStyle);
    const uRowH = fontRowHeight({ hindi: false, urdu: true }, hStyle, uStyle);

    const plan = planRows(hLines, uLines, hRowH, uRowH);
    const kept = fitRows(plan, availableH);
    const shown = kept.filter((r) => r.kind === "line");
    // Blank rows aren't "lines" as far as the overflow warning is concerned.
    const total = plan.filter((r) => r.kind === "line").length;

    // One common width for every line on the page (the longest), capped to the
    // full content width; shorter lines justify to fill it.
    const cap = 1080 - 2 * FRAME_SIDE_MARGIN - 10;
    let maxW = 0;
    shown.forEach((r) => {
      maxW = Math.max(maxW, measureTextWidth(r.text, r.lang === "urdu" ? uStyle : hStyle));
    });
    const width = Math.min(Math.ceil(maxW) + 1, cap);

    kept.forEach((r) => {
      const row = document.createElement("div");
      row.className = "stackRow";
      row.style.height = `${r.h}px`;
      if (r.kind === "line") {
        const style = r.lang === "urdu" ? uStyle : hStyle;
        const div = makeLineDiv(
          r.lang === "urdu" ? "urduLine" : "hindiLine",
          r.text,
          style,
          r.h,
          width
        );
        div.style.direction = r.lang === "urdu" ? "rtl" : "ltr";
        row.appendChild(div);
      }
      container.appendChild(row);
    });

    updateBodyWarning(total, shown.length, availableH);
  }

  window.LAYOUTS = window.LAYOUTS || {};
  window.LAYOUTS[ID] = { id: ID, name: "Stack", pageCount, renderPage };
})();
