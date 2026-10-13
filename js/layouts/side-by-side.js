/* ------------------------------------------------------------------ *
 * Layout: "Side by side"
 *
 * Hindi (left) and Urdu (right) appear in two columns. The body is one row
 * per line, paired by index (Hindi line i next to Urdu line i), with an empty
 * spacer after every two lines. Everything fits on a single page; if the text
 * is too long for the chosen font size, #bodyWarning tells the user.
 *
 * Relies on shared helpers from app.js (buildPairTable, buildFooter,
 * frameInnerHeight, makeLineDiv, bodyCapacity, measureTextWidth, …).
 * ------------------------------------------------------------------ */
(function () {
  const ID = "sideBySide";

  function pageCount() {
    return 1; // capacity-limited single page
  }

  function renderPage(/* page */) {
    const frame = els.frame;

    const title = buildPairTable("Title");
    const bodyArea = document.createElement("div");
    bodyArea.className = "bodyArea";
    bodyArea.style.marginTop = `${BODY_GAP}px`;
    const bodyTable = document.createElement("table");
    bodyTable.className = "bodyLines";
    bodyArea.appendChild(bodyTable);

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

    buildLines(bodyTable, availableH);
  }

  function buildLines(table, availableH) {
    const enabled = getEnabled();
    const enabledCount = (enabled.hindi ? 1 : 0) + (enabled.urdu ? 1 : 0);

    const hb = controls.hindiBody;
    const ub = controls.urduBody;
    const hindiLines = enabled.hindi ? splitLines(hb.text.value) : [];
    const urduLines = enabled.urdu ? splitLines(ub.text.value).map(urduText) : [];
    const total = Math.max(hindiLines.length, urduLines.length);

    const hStyle = lineStyleFor(hb, els.hindiFontSelect.value);
    const uStyle = lineStyleFor(ub, els.urduFontSelect.value);
    const rowH = fontRowHeight(enabled, hStyle, uStyle);

    const cap = bodyCapacity(availableH, rowH);
    const shown = Math.min(total, cap);

    // Longest line per column, capped to the column width.
    const colWidth = bodyColWidth(enabledCount);
    let maxH = 0;
    let maxU = 0;
    for (let i = 0; i < shown; i++) {
      if (enabled.hindi) maxH = Math.max(maxH, measureTextWidth(hindiLines[i], hStyle));
      if (enabled.urdu) maxU = Math.max(maxU, measureTextWidth(urduLines[i], uStyle));
    }
    let hWidth = Math.min(Math.ceil(maxH) + 1, colWidth);
    let uWidth = Math.min(Math.ceil(maxU) + 1, colWidth);
    // When both languages show, share one common width so the columns line up.
    if (enabledCount === 2) hWidth = uWidth = Math.max(hWidth, uWidth);
    const tdWidth = enabledCount === 2 ? "50%" : "100%";

    for (let i = 0; i < shown; i++) {
      const tr = document.createElement("tr");
      tr.id = `tr${i + 1}`;
      tr.style.height = `${rowH}px`;

      if (enabled.hindi) {
        const td = document.createElement("td");
        td.className = "hindiCell";
        td.style.width = tdWidth;
        td.appendChild(makeLineDiv("hindiLine", hindiLines[i], hStyle, rowH, hWidth));
        tr.appendChild(td);
      }
      if (enabled.urdu) {
        const td = document.createElement("td");
        td.className = "urduCell";
        td.style.width = tdWidth;
        td.appendChild(makeLineDiv("urduLine", urduLines[i], uStyle, rowH, uWidth));
        tr.appendChild(td);
      }
      table.appendChild(tr);

      // empty line after every two lines (but not after the final line)
      if ((i + 1) % 2 === 0 && i !== shown - 1) {
        const spacer = document.createElement("tr");
        spacer.className = "emptyLine";
        spacer.style.height = `${rowH}px`;
        const td = document.createElement("td");
        td.colSpan = Math.max(enabledCount, 1);
        td.innerHTML = "&nbsp;";
        spacer.appendChild(td);
        table.appendChild(spacer);
      }
    }

    updateBodyWarning(total, cap, availableH);
  }

  window.LAYOUTS = window.LAYOUTS || {};
  window.LAYOUTS[ID] = { id: ID, name: "Side by side", pageCount, renderPage };
})();