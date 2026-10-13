/* ------------------------------------------------------------------ *
 * Layout: "One pair at a page"
 *
 * One couplet per page: the first two Hindi lines, then the next two Urdu
 * lines, all centered on the page with one common width and justified text.
 * Titles and signatures sit close together at the centre (Hindi right-aligned,
 * Urdu left-aligned). Each page shows "n of N" at the bottom centre. Body text
 * is paginated two lines per language per page; app.js drives prev/next and
 * generates one image per page.
 * ------------------------------------------------------------------ */
(function () {
  const ID = "onePair";
  const PER_PAGE = 2; // lines per language per page

  function lines() {
    const enabled = getEnabled();
    return {
      enabled,
      hindi: enabled.hindi ? splitLines(controls.hindiBody.text.value) : [],
      urdu: enabled.urdu ? splitLines(controls.urduBody.text.value).map(urduText) : [],
    };
  }

  function pageCount() {
    const { hindi, urdu } = lines();
    const maxLines = Math.max(hindi.length, urdu.length);
    return Math.max(1, Math.ceil(maxLines / PER_PAGE));
  }

  function renderPage(page) {
    // This layout has no capacity warning (a fixed number of lines per page).
    els.bodyWarning.classList.add("d-none");

    const frame = els.frame;
    const title = buildPairTable("Title");

    const bodyArea = document.createElement("div");
    bodyArea.className = "bodyArea onePairBody";
    bodyArea.style.marginTop = `${BODY_GAP}px`;

    const signature = buildPairTable("Signature");
    signature.style.marginTop = `${BODY_GAP}px`;

    const footer = buildFooter();

    frame.append(title, bodyArea, signature, footer);

    // Page number only when there is more than one page.
    const count = pageCount();
    if (count > 1) {
      const pageNum = document.createElement("div");
      pageNum.className = "pageNumber";
      pageNum.textContent = `${page + 1} of ${count}`;
      frame.appendChild(pageNum);
    }

    buildLines(bodyArea, page);
  }

  function buildLines(container, page) {
    const { enabled, hindi, urdu } = lines();
    const hStyle = lineStyleFor(controls.hindiBody, els.hindiFontSelect.value);
    const uStyle = lineStyleFor(controls.urduBody, els.urduFontSelect.value);

    const start = page * PER_PAGE;
    const hLines = enabled.hindi ? hindi.slice(start, start + PER_PAGE) : [];
    const uLines = enabled.urdu ? urdu.slice(start, start + PER_PAGE) : [];

    const rowH = fontRowHeight(enabled, hStyle, uStyle);

    // One common width for every line on the page (the longest), capped to the
    // full content width; shorter lines justify to fill it.
    const cap = 1080 - 2 * FRAME_SIDE_MARGIN - 10;
    let maxW = 0;
    hLines.forEach((t) => (maxW = Math.max(maxW, measureTextWidth(t, hStyle))));
    uLines.forEach((t) => (maxW = Math.max(maxW, measureTextWidth(t, uStyle))));
    const width = Math.min(Math.ceil(maxW) + 1, cap);

    const addLine = (text, style, lang) => {
      const row = document.createElement("div");
      row.className = "centerRow";
      row.style.height = `${rowH}px`;
      const div = makeLineDiv(lang === "urdu" ? "urduLine" : "hindiLine", text, style, rowH, width);
      div.style.direction = lang === "urdu" ? "rtl" : "ltr";
      row.appendChild(div);
      container.appendChild(row);
    };

    hLines.forEach((t) => addLine(t, hStyle, "hindi"));
    if (hLines.length && uLines.length) {
      const spacer = document.createElement("div");
      spacer.className = "centerRow";
      spacer.style.height = `${rowH}px`;
      container.appendChild(spacer);
    }
    uLines.forEach((t) => addLine(t, uStyle, "urdu"));
  }

  window.LAYOUTS = window.LAYOUTS || {};
  window.LAYOUTS[ID] = { id: ID, name: "One pair at a page", pageCount, renderPage };
})();